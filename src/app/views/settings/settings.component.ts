// Archivo corregido: implementación limpia del componente de ajustes
import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { exportDB, importDB } from 'dexie-export-import';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    await this.notif.testNotification(this.reminderTitle, this.reminderBody);
  }

  clearReminders() {
    this.activeReminders.forEach(r => this.notif.cancelReminder(r.id));
    this.activeReminders = [];
  }

  async ngOnInit() {
    const currencySetting = await this.db.settings.get('currencySymbol');
    if (currencySetting) this.currencySymbol.set(currencySetting.value);

    const notificationsSetting = await this.db.settings.get('notificationsEnabled');
    if (notificationsSetting) this.notificationsEnabled.set(notificationsSetting.value);

    this.isInitialized.set(true);
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
      if (!confirm('¿Sobrescribir datos actuales con el archivo seleccionado?')) return;
      try {
        await this.db.delete();
        await this.db.open();
        await importDB(file);
        alert('Importación finalizada. Se recargará la app.');
        window.location.reload();
      } catch (e) {
        console.error('Error al importar la base de datos:', e);
        alert('Ocurrió un error al importar la base de datos.');
      }
    };
    input.click();
  }
}