import { Component, signal, inject, effect } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { VehiclesComponent } from './views/vehicles/vehicles.component';
import { RecordsComponent } from './views/records/records.component';
import { SettingsComponent } from './views/settings/settings.component';
import { TransactionModalComponent, TransactionData } from './components/transaction-modal/transaction-modal.component';
import { DatabaseService } from './services/database.service';
import { AddVehicleModalComponent } from './components/add-vehicle-modal/add-vehicle-modal.component';
import { Vehicle } from './services/database.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    DashboardComponent, 
    VehiclesComponent, 
    RecordsComponent, 
    SettingsComponent, 
    TransactionModalComponent,
    AddVehicleModalComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private db = inject(DatabaseService);
  private swUpdate = inject(SwUpdate, { optional: true });
  currentView = signal('dashboard');

  isTransactionModalOpen = signal(false);
  isAddVehicleModalOpen = signal(false);
  editingVehicle = signal<Vehicle | null>(null);
  modalVehicleId = signal<number | null>(null);
  modalTransactionType = signal<'income' | 'expense' | null>(null);
  modalVehicleAlias = signal<string | null>(null);

  // Signals para actualización PWA
  updateAvailable = signal(false);
  private dismissedThisSession = false;

  constructor() {
    // Escuchar actualizaciones si el service worker está habilitado
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(evt => {
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

  changeView(view: string) {
    this.currentView.set(view);
  }

  openAddVehicleModal() {
    this.editingVehicle.set(null);
    this.isAddVehicleModalOpen.set(true);
  }

  startEditVehicle(vehicle: Vehicle) {
    this.editingVehicle.set(vehicle);
    this.isAddVehicleModalOpen.set(true);
  }

  closeAddVehicleModal() {
    this.isAddVehicleModalOpen.set(false);
  }

  async saveVehicle(vehicleData: { alias: string, placa: string }) {
    await this.db.vehicles.add(vehicleData);
    this.closeAddVehicleModal();
  }

  async updateVehicle(data: { id: number, alias: string, placa: string }) {
    await this.db.vehicles.update(data.id, { alias: data.alias, placa: data.placa });
    this.closeAddVehicleModal();
  }

  async openTransactionModal(event: { vehicleId: number, type: 'income' | 'expense', vehicleAlias: string }) {
    this.modalVehicleId.set(event.vehicleId);
    this.modalTransactionType.set(event.type);
    this.modalVehicleAlias.set(event.vehicleAlias);
    this.isTransactionModalOpen.set(true);
  }

  closeTransactionModal() {
    this.isTransactionModalOpen.set(false);
  }

  async saveTransaction(transactionData: TransactionData) {
    await this.db.transactions.add(transactionData);
    this.closeTransactionModal();
  }
}
