import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  User,
  GoogleAuthProvider,
  getRedirectResult,
  linkWithRedirect,
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

  /** Resultado de vincular con Google vía redirect, disponible tras volver de accounts.google.com. */
  private _googleLinkOutcome = signal<LinkGoogleResult | null>(null);
  readonly googleLinkOutcome = this._googleLinkOutcome.asReadonly();

  /** Resuelve cuando llega el primer evento de auth (con o sin usuario), o al agotarse el timeout. */
  private readonly firstAuthEvent: Promise<void>;

  constructor() {
    let resolveFirstEvent!: () => void;
    this.firstAuthEvent = new Promise<void>((resolve) => {
      resolveFirstEvent = resolve;
    });

    onAuthStateChanged(this.auth, (user) => {
      console.log('[GoogleLink] onAuthStateChanged. uid=', user?.uid, 'anon=', user?.isAnonymous, 'providers=', user?.providerData.map(p => p.providerId));
      this._user.set(user);
      this._ready.set(true);
      resolveFirstEvent();
      if (!user) {
        console.log('[GoogleLink] Sin usuario -> creando sesión anónima nueva.');
        signInAnonymously(this.auth).catch((e) => console.error('No se pudo iniciar sesión anónima', e));
      }
    });

    // Recoge el resultado de un linkWithRedirect previo (si volvimos de accounts.google.com).
    console.log('[GoogleLink] Verificando getRedirectResult()... currentUser antes =', this.auth.currentUser?.uid, 'anon=', this.auth.currentUser?.isAnonymous);
    getRedirectResult(this.auth)
      .then((result) => {
        if (result) {
          console.log('[GoogleLink] getRedirectResult OK. uid=', result.user.uid, 'isAnonymous=', result.user.isAnonymous, 'providers=', result.user.providerData.map(p => p.providerId));
          this._googleLinkOutcome.set({ ok: true });
        } else {
          console.log('[GoogleLink] getRedirectResult devolvió null (no había redirect pendiente que procesar).');
        }
      })
      .catch((e: any) => {
        console.error('[GoogleLink] getRedirectResult ERROR. code=', e?.code, 'message=', e?.message, e);
        if (e?.code === 'auth/credential-already-in-use') {
          this._googleLinkOutcome.set({ ok: false, reason: 'in-use', error: e });
        } else if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
          this._googleLinkOutcome.set({ ok: false, reason: 'popup-closed', error: e });
        } else {
          this._googleLinkOutcome.set({ ok: false, reason: 'other', error: e });
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

  /**
   * Redirige a accounts.google.com para vincular la cuenta anónima (deja la página).
   * El resultado llega en `googleLinkOutcome` cuando la app vuelve a cargar.
   */
  async linkWithGoogle(): Promise<void> {
    const current = this.auth.currentUser;
    console.log('[GoogleLink] Iniciando linkWithRedirect. uid=', current?.uid, 'anon=', current?.isAnonymous);
    if (!current) return;
    try {
      await linkWithRedirect(current, new GoogleAuthProvider());
    } catch (e) {
      console.error('[GoogleLink] linkWithRedirect lanzó un error ANTES de redirigir:', e);
      throw e;
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
