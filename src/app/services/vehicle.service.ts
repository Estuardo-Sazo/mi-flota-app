import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Firestore, addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from '@angular/fire/firestore';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { SyncStatusService } from './sync-status.service';
import { vehiclesPath } from './firestore-paths';

export interface Vehicle {
  id: string;
  alias: string;
  placa: string;
  active?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private syncStatus = inject(SyncStatusService);

  private _vehicles = signal<Vehicle[]>([]);
  /** Todos los vehículos, incluyendo desactivados (para resolver alias en registros históricos). */
  readonly vehicles = this._vehicles.asReadonly();
  readonly activeVehicles = computed(() => this._vehicles().filter((v) => v.active !== false));
  readonly inactiveVehicles = computed(() => this._vehicles().filter((v) => v.active === false));

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.uid();
      if (!uid) {
        this._vehicles.set([]);
        return;
      }
      const col = collection(this.firestore, vehiclesPath(uid));
      const unsubscribe = onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
        this._vehicles.set(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vehicle));
        this.syncStatus.reportSourceMetadata('vehicles', {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      });
      onCleanup(() => unsubscribe());
    });
  }

  add(data: { alias: string; placa: string }) {
    const uid = this.requireUid();
    return addDoc(collection(this.firestore, vehiclesPath(uid)), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  update(id: string, data: Partial<{ alias: string; placa: string }>) {
    const uid = this.requireUid();
    return updateDoc(doc(this.firestore, `${vehiclesPath(uid)}/${id}`), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  remove(id: string) {
    const uid = this.requireUid();
    return deleteDoc(doc(this.firestore, `${vehiclesPath(uid)}/${id}`));
  }

  setActive(id: string, active: boolean) {
    const uid = this.requireUid();
    return updateDoc(doc(this.firestore, `${vehiclesPath(uid)}/${id}`), {
      active,
      updatedAt: serverTimestamp()
    });
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) throw new Error('No hay usuario autenticado');
    return uid;
  }
}
