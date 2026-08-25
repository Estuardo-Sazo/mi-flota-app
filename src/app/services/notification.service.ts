import { Injectable, effect, inject } from '@angular/core';
import { ReminderService, Reminder } from './reminder.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private reminderService = inject(ReminderService);
  private timers: Record<string, any> = {};
  private scheduledIds = new Set<string>();

  readonly reminders = this.reminderService.reminders;

  constructor() {
    // Reacciona a los reminders sincronizados desde Firestore: programa los nuevos,
    // cancela el timer local de los que ya no existan (borrados en otro dispositivo, etc.).
    effect(() => {
      const current = this.reminderService.reminders();
      const currentIds = new Set(current.map((r) => r.id));

      for (const id of [...this.scheduledIds]) {
        if (!currentIds.has(id)) {
          clearTimeout(this.timers[id]);
          delete this.timers[id];
          this.scheduledIds.delete(id);
        }
      }

      for (const r of current) {
        if (!this.scheduledIds.has(r.id)) {
          this.program(r);
          this.scheduledIds.add(r.id);
        }
      }
    });
  }

  async ensurePermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  scheduleDailyReminder(reminder: Omit<Reminder, 'id'>): string {
    const id = crypto.randomUUID();
    this.reminderService.set({ id, ...reminder }).catch((e) => console.error('No se pudo guardar el recordatorio', e));
    return id;
  }

  cancelReminder(id: string) {
    const t = this.timers[id];
    if (t) {
      clearTimeout(t);
      delete this.timers[id];
    }
    this.scheduledIds.delete(id);
    this.reminderService.remove(id).catch((e) => console.error('No se pudo eliminar el recordatorio', e));
  }

  listReminders(): Reminder[] {
    return this.reminderService.reminders();
  }

  private program(r: Reminder) {
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
