import { Injectable, effect, inject, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { SyncStatusService } from './sync-status.service';
import { settingsDocPath } from './firestore-paths';

export interface AppSettings {
  currencySymbol: string;
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: 'Q',
  notificationsEnabled: false
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private syncStatus = inject(SyncStatusService);

  private _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly settings = this._settings.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.uid();
      if (!uid) {
        this._settings.set(DEFAULT_SETTINGS);
        return;
      }
      const ref = doc(this.firestore, settingsDocPath(uid));
      const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
        this._settings.set({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings> | undefined) });
        this.syncStatus.reportSourceMetadata('settings', {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      });
      onCleanup(() => unsubscribe());
    });
  }

  update(data: Partial<AppSettings>) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('No hay usuario autenticado');
    return setDoc(doc(this.firestore, settingsDocPath(uid)), data, { merge: true });
  }
}
