import { Injectable, effect, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mi-flota-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _preference = signal<ThemePreference>(this.readStored());

  readonly preference = this._preference.asReadonly();

  constructor() {
    effect(() => {
      const pref = this._preference();
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      if (pref !== 'system') {
        root.classList.add(pref);
      }
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', () => {
      // Forzar reevaluación visual cuando el sistema cambia y estamos en modo 'system'.
      if (this._preference() === 'system') {
        this._preference.set('system');
      }
    });
  }

  setPreference(pref: ThemePreference) {
    this._preference.set(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  }

  toggle() {
    const isDarkNow = document.documentElement.classList.contains('dark') ||
      (this._preference() === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    this.setPreference(isDarkNow ? 'light' : 'dark');
  }

  private readStored(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }
}
