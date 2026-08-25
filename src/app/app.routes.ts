import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./views/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    data: { title: 'Dashboard' }
  },
  {
    path: 'vehiculos',
    loadComponent: () => import('./views/vehicles/vehicles.component').then((m) => m.VehiclesComponent),
    data: { title: 'Mis Vehículos' }
  },
  {
    path: 'registros',
    loadComponent: () => import('./views/records/records.component').then((m) => m.RecordsComponent),
    data: { title: 'Registros' }
  },
  {
    path: 'reportes',
    loadComponent: () => import('./views/reports/reports.component').then((m) => m.ReportsComponent),
    data: { title: 'Reportes' }
  },
  {
    path: 'ajustes',
    loadComponent: () => import('./views/settings/settings.component').then((m) => m.SettingsComponent),
    data: { title: 'Ajustes' }
  },
  { path: '**', redirectTo: 'dashboard' }
];
