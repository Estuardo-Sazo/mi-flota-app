import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" role="status">
          <span class="min-w-0 flex-1">{{ toast.message }}</span>
          @if (toast.actionLabel) {
            <button type="button" class="toast-action" (click)="toasts.runAction(toast)">{{ toast.actionLabel }}</button>
          }
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  toasts = inject(ToastService);
}
