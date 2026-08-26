import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleService, Vehicle } from '../../services/vehicle.service';
import { TransactionService } from '../../services/transaction.service';
import {
  TransactionModalComponent,
  TransactionData,
} from '../../components/transaction-modal/transaction-modal.component';
import { AddVehicleModalComponent } from '../../components/add-vehicle-modal/add-vehicle-modal.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [RouterLink, TransactionModalComponent, AddVehicleModalComponent, ConfirmDialogComponent],
  templateUrl: './vehicles.component.html',
  styleUrls: ['./vehicles.component.css']
})
export class VehiclesComponent {
  private vehicleService = inject(VehicleService);
  private transactionService = inject(TransactionService);

  vehicles = this.vehicleService.activeVehicles;
  inactiveCount = computed(() => this.vehicleService.inactiveVehicles().length);

  isTransactionModalOpen = signal(false);
  isAddVehicleModalOpen = signal(false);
  editingVehicle = signal<Vehicle | null>(null);
  modalVehicleId = signal<string | null>(null);
  modalTransactionType = signal<'income' | 'expense' | null>(null);
  modalVehicleAlias = signal<string | null>(null);
  deactivatingVehicle = signal<Vehicle | null>(null);

  addTransaction(vehicle: Vehicle, type: 'income' | 'expense') {
    if (vehicle.id) {
      this.modalVehicleId.set(vehicle.id);
      this.modalTransactionType.set(type);
      this.modalVehicleAlias.set(vehicle.alias);
      this.isTransactionModalOpen.set(true);
    }
  }

  closeTransactionModal() {
    this.isTransactionModalOpen.set(false);
  }

  async saveTransaction(transactionData: TransactionData) {
    await this.transactionService.add(transactionData);
    this.closeTransactionModal();
  }

  openAddVehicleModal() {
    this.editingVehicle.set(null);
    this.isAddVehicleModalOpen.set(true);
  }

  startEdit(vehicle: Vehicle) {
    this.editingVehicle.set(vehicle);
    this.isAddVehicleModalOpen.set(true);
  }

  closeAddVehicleModal() {
    this.isAddVehicleModalOpen.set(false);
  }

  async saveVehicle(vehicleData: { alias: string; placa: string }) {
    await this.vehicleService.add(vehicleData);
    this.closeAddVehicleModal();
  }

  async updateVehicle(data: { id: string; alias: string; placa: string }) {
    await this.vehicleService.update(data.id, { alias: data.alias, placa: data.placa });
    this.closeAddVehicleModal();
  }

  askDeactivate(vehicle: Vehicle) {
    this.deactivatingVehicle.set(vehicle);
  }

  cancelDeactivate() {
    this.deactivatingVehicle.set(null);
  }

  async confirmDeactivate() {
    const vehicle = this.deactivatingVehicle();
    if (vehicle?.id) {
      await this.vehicleService.setActive(vehicle.id, false);
    }
    this.deactivatingVehicle.set(null);
  }
}
