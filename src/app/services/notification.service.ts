import { Injectable } from '@angular/core';

interface ScheduledReminder {
  id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  title: string;
  body: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private reminders: ScheduledReminder[] = [];
  private timers: Record<string, any> = {};

  async ensurePermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  scheduleDailyReminder(reminder: Omit<ScheduledReminder, 'id'>): string {
    const id = crypto.randomUUID();
    const full: ScheduledReminder = { id, ...reminder };
    this.reminders.push(full);
    this.program(full);
    return id;
  }

  cancelReminder(id: string) {
    this.reminders = this.reminders.filter(r => r.id !== id);
    const t = this.timers[id];
    if (t) { clearTimeout(t); delete this.timers[id]; }
  }

  listReminders() { return [...this.reminders]; }

  private program(r: ScheduledReminder) {
    const now = new Date();
    const target = new Date();
    target.setHours(r.hour, r.minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
      // mañana
      target.setDate(target.getDate() + 1);
    }
    const delay = target.getTime() - now.getTime();
    this.timers[r.id] = setTimeout(async () => {
      if (await this.ensurePermission()) {
        new Notification(r.title, { body: r.body, tag: r.id });
      }
      // reprogramar siguiente día
      this.program(r);
    }, delay);
  }

  // Método rápido para disparar una notificación de prueba inmediata
  async testNotification(title = 'Recordatorio Mi Flota', body = 'Funciona la notificación') {
    if (await this.ensurePermission()) {
      new Notification(title, { body });
    }
  }
}
