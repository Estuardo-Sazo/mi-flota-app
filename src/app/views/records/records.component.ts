import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SettingsService } from '../../services/settings.service';

interface EnrichedTransaction extends Transaction {
  vehicleAlias?: string;
}

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css'],
})
export class RecordsComponent {
  private transactionService = inject(TransactionService);
  private vehicleService = inject(VehicleService);
  private settingsService = inject(SettingsService);

  transactions = this.transactionService.transactions;
  vehicles = this.vehicleService.vehicles;
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  deletingId = signal<string | null>(null);

  enrichedTransactions = computed<EnrichedTransaction[]>(() => {
    const vehicleMap = new Map(this.vehicles().map((v) => [v.id, v.alias]));
    return this.transactions()
      .map((tx) => ({
        ...tx,
        vehicleAlias: vehicleMap.get(tx.vehicleId) || 'Vehículo desconocido',
      }))
      .sort((a, b) => this.dateKey(b.date) - this.dateKey(a.date));
  });

  private dateKey(date: string) {
    // yyyy-MM-dd or ISO
    const dObj = new Date(date);
    return dObj.getFullYear() * 10000 + (dObj.getMonth() + 1) * 100 + dObj.getDate();
  }

  formatDate(date: string) {
    const dObj = new Date(date);
    const day = dObj.getDate();
    const month = dObj.getMonth() + 1;
    const year = dObj.getFullYear();
    const time = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}/${month}/${year} ${time}`;
  }

  askDelete(id?: string) {
    if (id == null) return;
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  async confirmDelete() {
    const id = this.deletingId();
    if (id != null) {
      await this.transactionService.remove(id);
    }
    this.deletingId.set(null);
  }
}
