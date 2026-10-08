import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { startOfMonth, endOfMonth } from 'date-fns';
import { VehicleService, Vehicle } from '../../services/vehicle.service';
import { TransactionService } from '../../services/transaction.service';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import {
  TransactionModalComponent,
  TransactionData,
} from '../../components/transaction-modal/transaction-modal.component';
import { AddVehicleModalComponent } from '../../components/add-vehicle-modal/add-vehicle-modal.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { queueWrite } from '../../utils/queue-write';
import { parseTxDate } from '../../utils/dates';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [RouterLink, DecimalPipe, TransactionModalComponent, AddVehicleModalComponent, ConfirmDialogComponent],
  templateUrl: './vehicles.component.html',
  styleUrls: ['./vehicles.component.css']
})
export class VehiclesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private transactionService = inject(TransactionService);
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  vehicles = this.vehicleService.activeVehicles;
  loaded = this.vehicleService.loaded;
  inactiveCount = computed(() => this.vehicleService.inactiveVehicles().length);
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  abs = Math.abs;

  /** Ingresos y gastos del mes en curso por vehículo. */
  monthStats = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const stats = new Map<string, { income: number; expense: number; net: number }>();
    for (const t of this.transactionService.transactions()) {
      const d = parseTxDate(t.date);
      if (d < start || d > end) continue;
      const s = stats.get(t.vehicleId) ?? { income: 0, expense: 0, net: 0 };
      if (t.type === 'income') s.income += t.amount;
      else s.expense += t.amount;
      s.net = s.income - s.expense;
      stats.set(t.vehicleId, s);
    }
    return stats;
  });

  statsOf(id: string) {
    return this.monthStats().get(id) ?? { income: 0, expense: 0, net: 0 };
  }

  isTransactionModalOpen = signal(false);
  isAddVehicleModalOpen = signal(false);
  editingVehicle = signal<Vehicle | null>(null);
  modalVehicleId = signal<string | null>(null);
  modalTransactionType = signal<'income' | 'expense' | null>(null);
  deactivatingVehicle = signal<Vehicle | null>(null);

  ngOnInit() {
    // Llegar desde el inicio con ?nuevo=1 abre el formulario de vehículo.
    if (this.route.snapshot.queryParamMap.get('nuevo')) {
      this.openAddVehicleModal();
    }
  }

  addTransaction(vehicle: Vehicle, type: 'income' | 'expense') {
    if (vehicle.id) {
      this.modalVehicleId.set(vehicle.id);
      this.modalTransactionType.set(type);
      this.isTransactionModalOpen.set(true);
    }
  }

  closeTransactionModal() {
    this.isTransactionModalOpen.set(false);
  }

  saveTransaction(transactionData: TransactionData) {
    if (queueWrite(() => this.transactionService.add(transactionData))) {
      this.closeTransactionModal();
    }
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

  saveVehicle(vehicleData: { alias: string; placa: string }) {
    if (queueWrite(() => this.vehicleService.add(vehicleData))) {
      this.closeAddVehicleModal();
    }
  }

  updateVehicle(data: { id: string; alias: string; placa: string }) {
    if (queueWrite(() => this.vehicleService.update(data.id, { alias: data.alias, placa: data.placa }))) {
      this.closeAddVehicleModal();
    }
  }

  askDeactivate(vehicle: Vehicle) {
    this.deactivatingVehicle.set(vehicle);
  }

  cancelDeactivate() {
    this.deactivatingVehicle.set(null);
  }

  confirmDeactivate() {
    const vehicle = this.deactivatingVehicle();
    if (vehicle?.id) {
      const id = vehicle.id;
      if (queueWrite(() => this.vehicleService.setActive(id, false))) {
        this.toast.show(`"${vehicle.alias}" desactivado`, {
          actionLabel: 'Deshacer',
          action: () => queueWrite(() => this.vehicleService.setActive(id, true)),
        });
      }
    }
    this.deactivatingVehicle.set(null);
  }
}
