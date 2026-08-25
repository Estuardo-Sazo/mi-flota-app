import { Injectable, effect, inject, signal } from '@angular/core';
import { Firestore, collection, deleteDoc, doc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { SyncStatusService } from './sync-status.service';
import { remindersPath } from './firestore-paths';

export interface Reminder {
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private syncStatus = inject(SyncStatusService);

  private _reminders = signal<Reminder[]>([]);
  readonly reminders = this._reminders.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.uid();
      if (!uid) {
        this._reminders.set([]);
        return;
      }
      const col = collection(this.firestore, remindersPath(uid));
      const unsubscribe = onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
        this._reminders.set(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reminder));
        this.syncStatus.reportSourceMetadata('reminders', {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      });
      onCleanup(() => unsubscribe());
    });
  }

  /** Usa setDoc con el id ya generado (crypto.randomUUID en NotificationService) en vez de addDoc. */
  set(reminder: Reminder) {
    const uid = this.requireUid();
    const { id, ...data } = reminder;
    return setDoc(doc(this.firestore, `${remindersPath(uid)}/${id}`), data);
  }

  remove(id: string) {
    const uid = this.requireUid();
    return deleteDoc(doc(this.firestore, `${remindersPath(uid)}/${id}`));
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) throw new Error('No hay usuario autenticado');
    return uid;
  }
}
