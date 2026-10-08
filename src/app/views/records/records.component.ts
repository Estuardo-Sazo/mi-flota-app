import { Component, signal, inject, computed, effect, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import {
  TransactionModalComponent,
  TransactionData,
} from '../../components/transaction-modal/transaction-modal.component';
import { queueWrite } from '../../utils/queue-write';
import { dayKey, dayLabel, parseTxDate, timeLabel } from '../../utils/dates';

interface EnrichedTransaction extends Transaction {
  vehicleAlias: string;
}

type TypeFilter = 'all' | 'income' | 'expense';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [DecimalPipe, TransactionModalComponent],
  templateUrl: './records.component.html',
  styleUrls: ['./records.component.css'],
})
export class RecordsComponent implements OnDestroy {
  private transactionService = inject(TransactionService);
  private vehicleService = inject(VehicleService);
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  vehicles = this.vehicleService.vehicles;
  hasActiveVehicles = computed(() => this.vehicleService.activeVehicles().length > 0);
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  abs = Math.abs;

  // Filtros
  query = signal('');
  typeFilter = signal<TypeFilter>('all');
  vehicleFilter = signal<string>('all');
  hasFilters = computed(() => !!this.query().trim() || this.typeFilter() !== 'all' || this.vehicleFilter() !== 'all');

  /** Todos los movimientos, del más reciente al más antiguo. */
  private all = computed<EnrichedTransaction[]>(() => {
    const names = new Map(this.vehicles().map((v) => [v.id, v.alias]));
    return this.transactionService
      .transactions()
      .map((tx) => ({ ...tx, vehicleAlias: names.get(tx.vehicleId) ?? 'Vehículo desconocido' }))
      .sort((a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime());
  });

  totalCount = computed(() => this.all().length);

  /** Vehículos que aparecen en algún movimiento (incluye desactivados), para el filtro. */
  vehicleOptions = computed(() => {
    const used = new Set(this.all().map((t) => t.vehicleId));
    return this.vehicles().filter((v) => used.has(v.id));
  });

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    const vehicle = this.vehicleFilter();
    return this.all().filter(
      (t) =>
        (type === 'all' || t.type === type) &&
        (vehicle === 'all' || t.vehicleId === vehicle) &&
        (!q || (t.description ?? '').toLowerCase().includes(q) || t.vehicleAlias.toLowerCase().includes(q))
    );
  });

  // Paginación (scroll infinito)
  visibleCount = signal(PAGE_SIZE);
  hasMore = computed(() => this.visibleCount() < this.filtered().length);

  /** Movimientos visibles agrupados por día, con el neto de cada día. */
  groups = computed(() => {
    const list = this.filtered();
    const dayNet = new Map<string, number>();
    for (const t of list) {
      const key = dayKey(parseTxDate(t.date));
      dayNet.set(key, (dayNet.get(key) ?? 0) + (t.type === 'income' ? t.amount : -t.amount));
    }
    const groups: { key: string; label: string; net: number; items: EnrichedTransaction[] }[] = [];
    for (const t of list.slice(0, this.visibleCount())) {
      const date = parseTxDate(t.date);
      const key = dayKey(date);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: dayLabel(date), net: dayNet.get(key) ?? 0, items: [] };
        groups.push(group);
      }
      group.items.push(t);
    }
    return groups;
  });

  isTransactionModalOpen = signal(false);

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

  // ---- Filtros ----
  setQuery(value: string) {
    this.query.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  setType(type: TypeFilter) {
    this.typeFilter.set(type);
    this.visibleCount.set(PAGE_SIZE);
  }

  setVehicle(id: string) {
    this.vehicleFilter.set(id);
    this.visibleCount.set(PAGE_SIZE);
  }

  clearFilters() {
    this.query.set('');
    this.typeFilter.set('all');
    this.vehicleFilter.set('all');
    this.visibleCount.set(PAGE_SIZE);
  }

  // ---- Formato ----
  timeLabel(date: string) {
    return timeLabel(parseTxDate(date));
  }

  // ---- Acciones ----
  openTransactionModal() {
    this.isTransactionModalOpen.set(true);
  }

  closeTransactionModal() {
    this.isTransactionModalOpen.set(false);
  }

  saveTransaction(data: TransactionData) {
    if (queueWrite(() => this.transactionService.add(data))) {
      this.closeTransactionModal();
    }
  }

  /** Elimina al instante y ofrece "Deshacer" (más rápido y seguro que pedir confirmación). */
  deleteTransaction(tx: EnrichedTransaction) {
    const { vehicleAlias: _alias, ...original } = tx;
    if (!queueWrite(() => this.transactionService.remove(tx.id))) return;
    this.toast.show('Registro eliminado', {
      actionLabel: 'Deshacer',
      action: () => queueWrite(() => this.transactionService.restore(original)),
    });
  }
}
