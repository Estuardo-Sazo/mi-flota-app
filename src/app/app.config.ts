import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  provideFirestore
} from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { MigrationService } from './services/migration.service';

// Habilitar SW basado en modo Angular (más confiable que import.meta.env)
const isProd = !isDevMode();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: isProd,
      registrationStrategy: 'registerWhenStable:3000'
    }),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      })
    ),
    provideAuth(() => getAuth()),
    provideAppInitializer(() => {
      // inject() debe llamarse sincrónicamente aquí, antes de cualquier await (NG0203).
      const authService = inject(AuthService);
      const migrationService = inject(MigrationService);
      return authService.waitForAuthReady().then(() => {
        // No se espera: la migración no debe bloquear el arranque offline-first.
        migrationService.migrateIfNeeded();
      });
    })
  ]
};
