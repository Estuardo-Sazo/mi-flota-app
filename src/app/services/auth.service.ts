import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  User,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signOut
} from '@angular/fire/auth';

export type LinkGoogleResult =
  | { ok: true }
  | { ok: false; reason: 'in-use' | 'popup-closed' | 'other'; error: unknown };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);

  private _user = signal<User | null>(null);
  private _ready = signal(false);

  readonly user = this._user.asReadonly();
  readonly ready = this._ready.asReadonly();
  readonly uid = computed(() => this._user()?.uid ?? null);
  readonly isAnonymous = computed(() => this._user()?.isAnonymous ?? true);
  readonly displayName = computed(() => this._user()?.displayName ?? null);
  readonly photoURL = computed(() => this._user()?.photoURL ?? null);
  readonly email = computed(() => this._user()?.email ?? null);

  /** Resuelve cuando llega el primer evento de auth (con o sin usuario), o al agotarse el timeout. */
  private readonly firstAuthEvent: Promise<void>;

  constructor() {
    let resolveFirstEvent!: () => void;
    this.firstAuthEvent = new Promise<void>((resolve) => {
      resolveFirstEvent = resolve;
    });

    onAuthStateChanged(this.auth, (user) => {
      this._user.set(user);
      this._ready.set(true);
      resolveFirstEvent();
      if (!user) {
        signInAnonymously(this.auth).catch((e) => console.error('No se pudo iniciar sesión anónima', e));
      }
    });
  }

  /** Espera a que la sesión (anónima o no) esté resuelta, con un timeout de seguridad para no bloquear el arranque offline. */
  waitForAuthReady(timeoutMs = 3000): Promise<void> {
    return Promise.race([
      this.firstAuthEvent,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  async linkWithGoogle(): Promise<LinkGoogleResult> {
    const current = this.auth.currentUser;
    if (!current) {
      return { ok: false, reason: 'other', error: new Error('No hay sesión activa') };
    }
    try {
      await linkWithPopup(current, new GoogleAuthProvider());
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'auth/credential-already-in-use') {
        return { ok: false, reason: 'in-use', error: e };
      }
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        return { ok: false, reason: 'popup-closed', error: e };
      }
      return { ok: false, reason: 'other', error: e };
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
