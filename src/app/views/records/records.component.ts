import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { DatabaseService, Transaction, Vehicle } from '../../services/database.service';
import { liveQuery } from 'dexie';
import { format } from 'date-fns';

interface EnrichedTransaction extends Transaction {
  vehicleAlias?: string;
}

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css']
})
export class RecordsComponent implements OnInit {
  private db = inject(DatabaseService);
  
  transactions = signal<Transaction[]>([]);
  vehicles = signal<Vehicle[]>([]);
  currencySymbol = signal('$');
  deletingId = signal<number | null>(null);

  enrichedTransactions = computed(() => {
    const vehicleMap = new Map(this.vehicles().map(v => [v.id, v.alias]));
    return this.transactions()
      .map(tx => ({
        ...tx,
        vehicleAlias: vehicleMap.get(tx.vehicleId) || 'Vehículo desconocido'
      }))
      .sort((a, b) => this.dateKey(b.date) - this.dateKey(a.date));
  });

  ngOnInit() {
    liveQuery(() => this.db.transactions.toArray()).subscribe(transactions => {
      this.transactions.set(transactions);
    });
    liveQuery(() => this.db.vehicles.toArray()).subscribe(vehicles => {
      this.vehicles.set(vehicles);
    });
    liveQuery(() => this.db.settings.get('currencySymbol')).subscribe(setting => {
      if (setting) {
        this.currencySymbol.set(setting.value);
      }
    });
  }

  private dateKey(date: string) { // yyyy-MM-dd
    const [y, m, d] = date.split('-').map(Number);
    return y * 10000 + m * 100 + d;
  }

  formatDate(date: string) {
    const [y, m, d] = date.split('-');
    return `${parseInt(d,10)}/${parseInt(m,10)}/${y}`;
  }

  askDelete(id?: number) {
    if (id == null) return;
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  async confirmDelete() {
    const id = this.deletingId();
    if (id != null) {
      await this.db.transactions.delete(id);
    }
    this.deletingId.set(null);
  }
}
