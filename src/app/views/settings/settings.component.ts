// Archivo corregido: implementación limpia del componente de ajustes
import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { exportDB, importDB } from 'dexie-export-import';
import Dexie from 'dexie';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf, NgFor],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private db = inject(DatabaseService);
  private notif = inject(NotificationService);

  currencySymbol = signal('$');
  notificationsEnabled = signal(false);
  isInitialized = signal(false);

  // Campos recordatorio
  reminderTime = '09:00';
  reminderTitle = 'Registrar movimientos';
  reminderBody = 'No olvides ingresar ingresos o gastos de tus vehículos.';
  activeReminders: { id: string; hour: number; minute: number; title: string }[] = [];
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
    // Persistencia automática cuando cambian los ajustes (evitando guardar durante carga inicial)
    effect(() => {
      if (this.isInitialized()) {
        this.db.settings.put({ key: 'currencySymbol', value: this.currencySymbol() });
      }
    });
    effect(() => {
      if (this.isInitialized()) {
        this.db.settings.put({ key: 'notificationsEnabled', value: this.notificationsEnabled() });
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
    const hour = parseInt(hStr, 10); const minute = parseInt(mStr, 10);
    const id = this.notif.scheduleDailyReminder({ hour, minute, title: this.reminderTitle, body: this.reminderBody });
    this.activeReminders.push({ id, hour, minute, title: this.reminderTitle });
  }

  async testNow() {
  if (this.testingNotification) return;
  this.testingNotification = true;
  await this.notif.testNotification(this.reminderTitle, this.reminderBody);
  setTimeout(() => this.testingNotification = false, 800);
  }

  clearReminders() {
    this.activeReminders.forEach(r => this.notif.cancelReminder(r.id));
    this.activeReminders = [];
  }

  removeReminder(id: string) {
    this.notif.cancelReminder(id);
    this.activeReminders = this.activeReminders.filter(r => r.id !== id);
  }

  async ngOnInit() {
    const currencySetting = await this.db.settings.get('currencySymbol');
    if (currencySetting) this.currencySymbol.set(currencySetting.value);

    const notificationsSetting = await this.db.settings.get('notificationsEnabled');
    if (notificationsSetting) this.notificationsEnabled.set(notificationsSetting.value);

    this.isInitialized.set(true);

  // cargar recordatorios ya persistidos
  const existing = this.notif.listReminders();
  this.activeReminders = existing.map(r => ({ id: r.id, hour: r.hour, minute: r.minute, title: r.title }));
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  async exportDb() {
    try {
      const blob = await exportDB(this.db);
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
      try {
        // Cerrar conexiones abiertas
        this.db.close();
        // Borrar DB existente para evitar conflictos de versiones/tablas
        await Dexie.delete(this.db.name);
        // Importar (crea la DB con el nombre embebido en el archivo)
        await importDB(file);
        // Reabrir nuestra instancia (aplicará migraciones a v2 si el backup era v1)
        await this.db.open();
        alert('Importación completada. Se recargará la aplicación.');
        window.location.reload();
      } catch (e: any) {
        console.error('Error al importar respaldo:', e);
        alert('Fallo al importar. Detalle: ' + (e?.message || e));
        try { await this.db.open(); } catch {}
      }
    };
    input.click();
  }
}