import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

// Angular 20 con builder moderno expone import.meta.env?.PROD si se define al construir.
// Fallback a comprobar process.env.NODE_ENV por si se ejecuta en herramientas externas.
const isProd = (import.meta as any).env?.PROD === true;

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
