import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SettingsService } from '../../services/settings.service';
import { BarChartComponent, ChartPoint } from '../../components/bar-chart/bar-chart.component';
import {
  TransactionModalComponent,
  TransactionData,
} from '../../components/transaction-modal/transaction-modal.component';
import { queueWrite } from '../../utils/queue-write';
import { dayKey, dayLabel, parseTxDate, timeLabel } from '../../utils/dates';
import { startOfMonth, endOfMonth, format, addMonths, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

function totals(list: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BarChartComponent, TransactionModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private transactionService = inject(TransactionService);
  private vehicleService = inject(VehicleService);
  private settingsService = inject(SettingsService);

  transactions = this.transactionService.transactions;
  vehiclesLoaded = this.vehicleService.loaded;
  hasVehicles = computed(() => this.vehicleService.activeVehicles().length > 0);
  /** Hay vehículos pero todos están desactivados. */
  onlyInactiveVehicles = computed(() => !this.hasVehicles() && this.vehicleService.vehicles().length > 0);
  abs = Math.abs;
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  selectedMonth = signal<Date>(startOfMonth(new Date()));

  // Registro rápido
  isTransactionModalOpen = signal(false);

  ngOnInit() {
    // Atajo de la PWA: /dashboard?add=transaction abre el registro directamente.
    if (this.route.snapshot.queryParamMap.get('add') === 'transaction' && this.hasVehicles()) {
      this.openQuickTransaction();
    }
  }

  openQuickTransaction() {
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

  // ---- Datos del mes ----
  private inMonth(list: Transaction[], month: Date) {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return list.filter((t) => {
      const d = parseTxDate(t.date);
      return d >= start && d <= end;
    });
  }

  currentMonthTransactions = computed(() => this.inMonth(this.transactions(), this.selectedMonth()));
  monthTotals = computed(() => totals(this.currentMonthTransactions()));
  monthlyIncome = computed(() => this.monthTotals().income);
  monthlyExpenses = computed(() => this.monthTotals().expense);
  netEarnings = computed(() => this.monthTotals().net);

  /** Diferencia de ganancia contra el mes anterior (null si el mes anterior no tuvo movimientos). */
  comparison = computed(() => {
    const prevMonth = addMonths(this.selectedMonth(), -1);
    const prev = this.inMonth(this.transactions(), prevMonth);
    if (prev.length === 0) return null;
    return {
      delta: this.netEarnings() - totals(prev).net,
      label: format(prevMonth, 'MMMM', { locale: es }),
    };
  });

  // ---- Últimos 7 días ----
  weekChart = computed<ChartPoint[]>(() => {
    const end = this.isCurrentMonth() ? new Date() : endOfMonth(this.selectedMonth());
    const all = this.transactions();
    const points: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(end, i);
      const key = dayKey(day);
      const { income, expense } = totals(all.filter((t) => dayKey(parseTxDate(t.date)) === key));
      points.push({
        label: format(day, 'EEE', { locale: es }).replace('.', ''),
        income,
        expense,
        highlight: isSameDay(day, new Date()),
      });
    }
    return points;
  });
  weekHasData = computed(() => this.weekChart().some((p) => p.income > 0 || p.expense > 0));

  // ---- Por vehículo ----
  byVehicle = computed(() => {
    const names = new Map(this.vehicleService.vehicles().map((v) => [v.id, v.alias]));
    const groups = new Map<string, Transaction[]>();
    for (const t of this.currentMonthTransactions()) {
      const list = groups.get(t.vehicleId) ?? [];
      list.push(t);
      groups.set(t.vehicleId, list);
    }
    const rows = [...groups.entries()].map(([id, list]) => ({
      id,
      alias: names.get(id) ?? 'Vehículo desconocido',
      ...totals(list),
    }));
    const maxIncome = Math.max(1, ...rows.map((r) => r.income));
    return rows
      .sort((a, b) => b.net - a.net)
      .map((r) => ({ ...r, incomeShare: (r.income / maxIncome) * 100 }));
  });

  // ---- Listas ----
  recentTransactions = computed(() => {
    const names = new Map(this.vehicleService.vehicles().map((v) => [v.id, v.alias]));
    return [...this.transactions()]
      .sort((a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime())
      .slice(0, 5)
      .map((t) => ({ ...t, vehicleAlias: names.get(t.vehicleId) ?? 'Vehículo desconocido' }));
  });

  dailySummaries = computed(() => {
    const map = new Map<string, { date: Date; income: number; expense: number; balance: number }>();
    for (const t of this.currentMonthTransactions()) {
      const d = parseTxDate(t.date);
      const key = dayKey(d);
      const entry = map.get(key) ?? { date: d, income: 0, expense: 0, balance: 0 };
      if (t.type === 'income') {
        entry.income += t.amount;
        entry.balance += t.amount;
      } else {
        entry.expense += t.amount;
        entry.balance -= t.amount;
      }
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  recentDailySummaries = computed(() => this.dailySummaries().slice(0, 3));

  // ---- Formato ----
  dayLabel = dayLabel;
  timeLabel(date: string) {
    return timeLabel(parseTxDate(date));
  }

  monthLabel() {
    return format(this.selectedMonth(), 'MMMM yyyy', { locale: es });
  }

  prevMonth() {
    this.selectedMonth.set(startOfMonth(addMonths(this.selectedMonth(), -1)));
  }

  nextMonth() {
    const next = startOfMonth(addMonths(this.selectedMonth(), 1));
    // Evitar avanzar más allá del mes actual
    if (next <= startOfMonth(new Date())) {
      this.selectedMonth.set(next);
    }
  }

  isCurrentMonth() {
    return startOfMonth(new Date()).getTime() === this.selectedMonth().getTime();
  }
}
