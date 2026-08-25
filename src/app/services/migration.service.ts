import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, serverTimestamp, setDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import type { DatabaseService } from './database.service';
import { remindersPath, settingsDocPath, transactionsPath, vehiclesPath } from './firestore-paths';
import { chunk } from '../utils/chunk';

const BATCH_CHUNK_SIZE = 450;
const LEGACY_DB_NAME = 'MotoAppDB';

@Injectable({ providedIn: 'root' })
export class MigrationService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private db: DatabaseService | null = null;

  /**
   * Migra datos locales de Dexie a Firestore una sola vez por uid. No falla el arranque si algo sale mal.
   * `dexie` solo se descarga (import dinámico) si se detecta la DB legacy — los usuarios nuevos nunca la cargan.
   */
  async migrateIfNeeded(): Promise<void> {
    const uid = this.auth.uid();
    if (!uid) return;

    const doneKey = `mi-flota-migrated-${uid}`;
    const inProgressKey = `mi-flota-migration-in-progress-${uid}`;

    if (localStorage.getItem(doneKey) === 'true') return;
    if (localStorage.getItem(inProgressKey) === 'true') {
      console.warn('Migración anterior quedó incompleta; requiere revisión manual (exportar/importar backup).');
      return;
    }

    if (!(await this.legacyDbMayExist())) {
      localStorage.setItem(doneKey, 'true');
      return;
    }

    try {
      const { DatabaseService } = await import('./database.service');
      this.db = new DatabaseService();
      await this.db.open();

      const [vehicleCount, transactionCount] = await Promise.all([
        this.db.vehicles.count(),
        this.db.transactions.count()
      ]);

      if (vehicleCount === 0 && transactionCount === 0) {
        localStorage.setItem(doneKey, 'true');
        return;
      }

      localStorage.setItem(inProgressKey, 'true');

      const idMap = await this.migrateVehicles(uid);
      await this.migrateTransactions(uid, idMap);
      await this.migrateSettings(uid);
      await this.migrateReminders(uid);

      localStorage.setItem(doneKey, 'true');
      localStorage.removeItem(inProgressKey);
    } catch (e) {
      console.error('Falló la migración de datos locales a la nube', e);
      // inProgressKey queda marcado a propósito: evita reintentos automáticos que dupliquen datos.
    }
  }

  /** Chequeo barato (sin cargar dexie) de si la DB legacy podría existir en este navegador. */
  private async legacyDbMayExist(): Promise<boolean> {
    if (!('databases' in indexedDB)) return true; // no se puede verificar (Safari viejo); asumir que sí y dejar que Dexie confirme
    try {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === LEGACY_DB_NAME);
    } catch {
      return true;
    }
  }

  private async migrateVehicles(uid: string): Promise<Map<number, string>> {
    const idMap = new Map<number, string>();
    const oldVehicles = await this.db!.vehicles.toArray();
    if (oldVehicles.length === 0) return idMap;

    for (const group of chunk(oldVehicles, BATCH_CHUNK_SIZE)) {
      const batch = writeBatch(this.firestore);
      for (const v of group) {
        const ref = doc(collection(this.firestore, vehiclesPath(uid)));
        idMap.set(v.id!, ref.id);
        batch.set(ref, {
          alias: v.alias,
          placa: v.placa,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
    return idMap;
  }

  private async migrateTransactions(uid: string, idMap: Map<number, string>): Promise<void> {
    const oldTransactions = await this.db!.transactions.toArray();
    for (const group of chunk(oldTransactions, BATCH_CHUNK_SIZE)) {
      const batch = writeBatch(this.firestore);
      for (const t of group) {
        const newVehicleId = idMap.get(t.vehicleId);
        if (!newVehicleId) {
          console.warn(`Transacción ${t.id} huérfana (vehicleId ${t.vehicleId} no encontrado), se omite`);
          continue;
        }
        const ref = doc(collection(this.firestore, transactionsPath(uid)));
        batch.set(ref, {
          vehicleId: newVehicleId,
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
  }

  private async migrateSettings(uid: string): Promise<void> {
    const oldSettings = await this.db!.settings.toArray();
    if (oldSettings.length === 0) return;
    const data: Record<string, unknown> = {};
    for (const s of oldSettings) data[s.key] = s.value;
    await setDoc(doc(this.firestore, settingsDocPath(uid)), data, { merge: true });
  }

  private async migrateReminders(uid: string): Promise<void> {
    const oldReminders = (await (this.db as any).reminders?.toArray?.()) ?? [];
    for (const r of oldReminders) {
      const { id, ...data } = r;
      await setDoc(doc(this.firestore, `${remindersPath(uid)}/${id}`), data);
    }
  }
}
