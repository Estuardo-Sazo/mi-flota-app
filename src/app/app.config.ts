import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

// Habilitar SW basado en modo Angular (más confiable que import.meta.env)
const isProd = !isDevMode();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: isProd,
      registrationStrategy: 'registerWhenStable:3000'
    })
  ]
};
