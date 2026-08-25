import { Component, signal, inject, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from '@angular/fire/firestore';
import { SettingsService } from '../../services/settings.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ThemeService, ThemePreference } from '../../services/theme.service';
import { remindersPath, settingsDocPath, transactionsPath, vehiclesPath } from '../../services/firestore-paths';
import { chunk } from '../../utils/chunk';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  private firestore = inject(Firestore);
  private settingsService = inject(SettingsService);
  private notif = inject(NotificationService);
  auth = inject(AuthService);
  theme = inject(ThemeService);

  themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];

  currencySymbol = signal('$');
  notificationsEnabled = signal(false);
  isInitialized = signal(false);
  private hasSyncedFromRemote = false;

  // Cuenta / sincronización
  googleLinkState = signal<'idle' | 'linking' | 'in-use' | 'error'>('idle');

  // Campos recordatorio
  reminderTime = '09:00';
  reminderTitle = 'Registrar movimientos';
  reminderBody = 'No olvides ingresar ingresos o gastos de tus vehículos.';
  activeReminders = computed(() =>
    this.notif.reminders().map((r) => ({ id: r.id, hour: r.hour, minute: r.minute, title: r.title }))
  );
  testingNotification = false;

  currencies = [
    { symbol: '$', name: 'USD' },
    { symbol: '€', name: 'EUR' },
    { symbol: 'Q', name: 'GTQ' },
    { symbol: '£', name: 'GBP' },
    { symbol: '¥', name: 'JPY' },
    { symbol: '₹', name: 'INR' },
  ];

  constructor() {
    // Carga inicial desde Firestore (una sola vez, para no pisar ediciones locales en curso).
    effect(() => {
      const remote = this.settingsService.settings();
      if (!this.hasSyncedFromRemote) {
        this.currencySymbol.set(remote.currencySymbol);
        this.notificationsEnabled.set(remote.notificationsEnabled);
        this.hasSyncedFromRemote = true;
        this.isInitialized.set(true);
      }
    });

    // Persistencia automática cuando cambian los ajustes (evitando guardar durante carga inicial)
    effect(() => {
      if (this.isInitialized()) {
        this.settingsService.update({ currencySymbol: this.currencySymbol() });
      }
    });
    effect(() => {
      if (this.isInitialized()) {
        this.settingsService.update({ notificationsEnabled: this.notificationsEnabled() });
        if (this.notificationsEnabled()) {
          this.requestNotificationPermission();
        }
      }
    });
  }

  async scheduleReminder() {
    if (!this.notificationsEnabled()) {
      alert('Activa las notificaciones primero.');
      return;
    }
    const [hStr, mStr] = this.reminderTime.split(':');
    const hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    this.notif.scheduleDailyReminder({ hour, minute, title: this.reminderTitle, body: this.reminderBody });
  }

  async testNow() {
    if (this.testingNotification) return;
    this.testingNotification = true;
    await this.notif.testNotification(this.reminderTitle, this.reminderBody);
    setTimeout(() => (this.testingNotification = false), 800);
  }

  clearReminders() {
    this.activeReminders().forEach((r) => this.notif.cancelReminder(r.id));
  }

  removeReminder(id: string) {
    this.notif.cancelReminder(id);
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  async connectGoogle() {
    this.googleLinkState.set('linking');
    const result = await this.auth.linkWithGoogle();
    if (result.ok) {
      this.googleLinkState.set('idle');
    } else if (result.reason === 'in-use') {
      this.googleLinkState.set('in-use');
    } else if (result.reason === 'popup-closed') {
      this.googleLinkState.set('idle');
    } else {
      this.googleLinkState.set('error');
      console.error('Error al vincular con Google', result.error);
    }
  }

  async signOutAccount() {
    if (!confirm('¿Cerrar sesión? En este dispositivo perderás acceso a estos datos hasta volver a iniciar sesión con la misma cuenta.')) return;
    await this.auth.signOut();
  }

  async exportDb() {
    const uid = this.auth.uid();
    if (!uid) return;
    try {
      const [vehiclesSnap, transactionsSnap, remindersSnap] = await Promise.all([
        getDocs(collection(this.firestore, vehiclesPath(uid))),
        getDocs(collection(this.firestore, transactionsPath(uid))),
        getDocs(collection(this.firestore, remindersPath(uid)))
      ]);
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        vehicles: vehiclesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        transactions: transactionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        reminders: remindersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        settings: this.settingsService.settings()
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mi-flota-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Base de datos exportada exitosamente.');
    } catch (e) {
      console.error('Error al exportar la base de datos:', e);
      alert('Ocurrió un error al exportar la base de datos.');
    }
  }

  importDb() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm('¿Sobrescribir todos los datos actuales con el respaldo?')) return;
      const uid = this.auth.uid();
      if (!uid) return;
      try {
        const data = JSON.parse(await file.text());

        await this.replaceCollection(vehiclesPath(uid), data.vehicles ?? [], (v: any) => ({
          alias: v.alias,
          placa: v.placa,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
        await this.replaceCollection(transactionsPath(uid), data.transactions ?? [], (t: any) => ({
          vehicleId: t.vehicleId,
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: serverTimestamp()
        }));
        await this.replaceCollection(remindersPath(uid), data.reminders ?? [], (r: any) => ({
          hour: r.hour,
          minute: r.minute,
          title: r.title,
          body: r.body
        }));
        if (data.settings) {
          await setDoc(doc(this.firestore, settingsDocPath(uid)), data.settings, { merge: true });
        }
        alert('Importación completada.');
      } catch (e: any) {
        console.error('Error al importar respaldo:', e);
        alert('Fallo al importar. Detalle: ' + (e?.message || e));
      }
    };
    input.click();
  }

  /** Borra todos los documentos existentes en `path` y los reemplaza por `items`, conservando sus ids originales. */
  private async replaceCollection(
    path: string,
    items: Array<{ id?: string }>,
    mapData: (item: any) => Record<string, unknown>
  ) {
    const existing = await getDocs(collection(this.firestore, path));
    for (const group of chunk(existing.docs, 450)) {
      const batch = writeBatch(this.firestore);
      for (const d of group) batch.delete(d.ref);
      await batch.commit();
    }
    const withId = items.filter((i) => i.id);
    for (const group of chunk(withId, 450)) {
      const batch = writeBatch(this.firestore);
      for (const item of group) {
        batch.set(doc(this.firestore, `${path}/${item.id}`), mapData(item));
      }
      await batch.commit();
    }
  }
}
