import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

export interface ToastOptions {
  actionLabel?: string;
  action?: () => void;
  /** Milisegundos antes de ocultarse solo (por defecto 5000). */
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, options: ToastOptions = {}) {
    const id = this.nextId++;
    this._toasts.update((list) => [...list.slice(-2), { id, message, actionLabel: options.actionLabel, action: options.action }]);
    setTimeout(() => this.dismiss(id), options.duration ?? 5000);
    return id;
  }

  runAction(toast: Toast) {
    toast.action?.();
    this.dismiss(toast.id);
  }

  dismiss(id: number) {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
