import { Component, signal, inject, computed, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SettingsService } from '../../services/settings.service';

interface EnrichedTransaction extends Transaction {
  vehicleAlias?: string;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css'],
})
export class RecordsComponent implements OnDestroy {
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  visibleCount = signal(PAGE_SIZE);
  visibleTransactions = computed(() => this.enrichedTransactions().slice(0, this.visibleCount()));
  hasMore = computed(() => this.visibleCount() < this.enrichedTransactions().length);

  private sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private observer?: IntersectionObserver;

  constructor() {
    effect(() => {
      const el = this.sentinel()?.nativeElement;
      this.observer?.disconnect();
      if (!el) return;
      this.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.loadMore();
      });
      this.observer.observe(el);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  loadMore() {
    if (this.hasMore()) this.visibleCount.update((n) => n + PAGE_SIZE);
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
