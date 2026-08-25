import { Injectable, computed, signal } from '@angular/core';

export type SyncStatus = 'synced' | 'offline' | 'syncing';

@Injectable({ providedIn: 'root' })
export class SyncStatusService {
  private _browserOnline = signal(navigator.onLine);
  private _pendingSources = signal<ReadonlySet<string>>(new Set());
  private _cachedSources = signal<ReadonlySet<string>>(new Set());

  readonly online = this._browserOnline.asReadonly();
  readonly hasPendingWrites = computed(() => this._pendingSources().size > 0);
  readonly isFromCache = computed(() => this._cachedSources().size > 0);

  readonly status = computed<SyncStatus>(() => {
    if (!this._browserOnline()) return 'offline';
    if (this.hasPendingWrites()) return 'syncing';
    return 'synced';
  });

  constructor() {
    window.addEventListener('online', () => this._browserOnline.set(true));
    window.addEventListener('offline', () => this._browserOnline.set(false));
  }

  /** Cada servicio de dominio reporta aquí la metadata de su último snapshot de Firestore. */
  reportSourceMetadata(sourceKey: string, meta: { fromCache: boolean; hasPendingWrites: boolean }) {
    this.updateSet(this._pendingSources, sourceKey, meta.hasPendingWrites);
    this.updateSet(this._cachedSources, sourceKey, meta.fromCache);
  }

  private updateSet(sig: typeof this._pendingSources, key: string, present: boolean) {
    const current = sig();
    const has = current.has(key);
    if (present === has) return;
    const next = new Set(current);
    if (present) next.add(key);
    else next.delete(key);
    sig.set(next);
  }
}
