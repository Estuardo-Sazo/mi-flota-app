import { Component, signal, inject, computed } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SyncBadgeComponent } from './components/sync-badge/sync-badge.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SyncBadgeComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private swUpdate = inject(SwUpdate, { optional: true });
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  theme = inject(ThemeService);

  viewTitle = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.leafTitle())
    ),
    { initialValue: this.leafTitle() }
  );

  isDarkActive = computed(() => {
    const pref = this.theme.preference();
    if (pref === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return pref === 'dark';
  });

  // Signals para actualización PWA
  updateAvailable = signal(false);
  private dismissedThisSession = false;

  constructor() {
    // Escuchar actualizaciones si el service worker está habilitado
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          if (!this.dismissedThisSession) {
            this.updateAvailable.set(true);
          }
        }
      });
    }
  }

  reloadApp() {
    this.updateAvailable.set(false);
    this.swUpdate?.activateUpdate().then(() => document.location.reload());
  }

  dismissUpdate() {
    this.dismissedThisSession = true;
    this.updateAvailable.set(false);
  }

  toggleTheme() {
    this.theme.toggle();
  }

  private leafTitle(): string {
    let r = this.route.snapshot;
    while (r.firstChild) r = r.firstChild;
    return (r.data['title'] as string) ?? '';
  }
}
