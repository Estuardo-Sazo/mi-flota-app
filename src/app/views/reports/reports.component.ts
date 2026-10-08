import { Component, signal, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  parseISO,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import { BarChartComponent, ChartPoint } from '../../components/bar-chart/bar-chart.component';
import { dayKey, dayLabel, parseTxDate, timeLabel } from '../../utils/dates';

type Preset = 'today' | 'week' | 'month' | 'prevMonth' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: '7 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'prevMonth', label: 'Mes anterior' },
  { id: 'custom', label: 'Personalizado' },
];

const toInput = (d: Date) => format(d, 'yyyy-MM-dd');

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [DecimalPipe, FormsModule, BarChartComponent],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent {
  private transactionService = inject(TransactionService);
  private vehicleService = inject(VehicleService);
  private settingsService = inject(SettingsService);
  private toast = inject(ToastService);

  readonly presets = PRESETS;
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  abs = Math.abs;

  preset = signal<Preset>('month');
  startDate = signal(toInput(startOfMonth(new Date())));
  endDate = signal(toInput(new Date()));
  vehicleFilter = signal<string>('all');
  expandedDays = signal<ReadonlySet<string>>(new Set());

  // ---- Periodo ----
  setPreset(preset: Preset) {
    const today = new Date();
    this.preset.set(preset);
    this.expandedDays.set(new Set());
    switch (preset) {
      case 'today':
        this.startDate.set(toInput(today));
        this.endDate.set(toInput(today));
        break;
      case 'week':
        this.startDate.set(toInput(subDays(today, 6)));
        this.endDate.set(toInput(today));
        break;
      case 'month':
        this.startDate.set(toInput(startOfMonth(today)));
        this.endDate.set(toInput(today));
        break;
      case 'prevMonth': {
        const prev = subMonths(today, 1);
        this.startDate.set(toInput(startOfMonth(prev)));
        this.endDate.set(toInput(endOfMonth(prev)));
        break;
      }
    }
  }

  setStart(value: string) {
    if (!value) return;
    this.startDate.set(value);
    this.preset.set('custom');
  }

  setEnd(value: string) {
    if (!value) return;
    this.endDate.set(value);
    this.preset.set('custom');
  }

  periodLabel = computed(() => {
    const start = parseISO(this.startDate());
    const end = parseISO(this.endDate());
    if (isSameDay(start, end)) return format(start, "d 'de' MMMM yyyy", { locale: es });
    return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`;
  });

  // ---- Datos ----
  private names = computed(() => new Map(this.vehicleService.vehicles().map((v) => [v.id, v.alias])));

  /** Movimientos del periodo (y vehículo) elegidos, del más reciente al más antiguo. */
  filtered = computed(() => {
    const start = startOfDay(parseISO(this.startDate()));
    const end = endOfDay(parseISO(this.endDate()));
    const vehicle = this.vehicleFilter();
    return this.transactionService
      .transactions()
      .filter((t) => {
        const d = parseTxDate(t.date);
        return d >= start && d <= end && (vehicle === 'all' || t.vehicleId === vehicle);
      })
      .sort((a, b) => parseTxDate(b.date).getTime() - parseTxDate(a.date).getTime());
  });

  /** Vehículos con movimientos dentro del periodo (sin aplicar el filtro de vehículo). */
  vehicleOptions = computed(() => {
    const start = startOfDay(parseISO(this.startDate()));
    const end = endOfDay(parseISO(this.endDate()));
    const used = new Set(
      this.transactionService
        .transactions()
        .filter((t) => {
          const d = parseTxDate(t.date);
          return d >= start && d <= end;
        })
        .map((t) => t.vehicleId)
    );
    return this.vehicleService.vehicles().filter((v) => used.has(v.id));
  });

  summary = computed(() => {
    let income = 0;
    let expense = 0;
    for (const t of this.filtered()) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    const activeDays = new Set(this.filtered().map((t) => dayKey(parseTxDate(t.date)))).size;
    const balance = income - expense;
    return { income, expense, balance, count: this.filtered().length, activeDays, avgPerDay: activeDays ? balance / activeDays : 0 };
  });

  chart = computed<ChartPoint[]>(() => {
    const start = startOfDay(parseISO(this.startDate()));
    const end = startOfDay(parseISO(this.endDate()));
    if (end < start) return [];
    const list = this.filtered();
    const days = differenceInCalendarDays(end, start) + 1;
    const sum = (items: Transaction[]) => ({
      income: items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    });

    if (days <= 31) {
      return eachDayOfInterval({ start, end }).map((day) => {
        const key = dayKey(day);
        return {
          label: days <= 7 ? format(day, 'EEE', { locale: es }).replace('.', '') : format(day, 'd'),
          ...sum(list.filter((t) => dayKey(parseTxDate(t.date)) === key)),
          highlight: isSameDay(day, new Date()),
        };
      });
    }
    return eachMonthOfInterval({ start, end }).map((month) => {
      const key = format(month, 'yyyy-MM');
      return {
        label: format(month, 'MMM', { locale: es }).replace('.', ''),
        ...sum(list.filter((t) => format(parseTxDate(t.date), 'yyyy-MM') === key)),
      };
    });
  });

  byVehicle = computed(() => {
    const groups = new Map<string, { income: number; expense: number }>();
    for (const t of this.filtered()) {
      const g = groups.get(t.vehicleId) ?? { income: 0, expense: 0 };
      if (t.type === 'income') g.income += t.amount;
      else g.expense += t.amount;
      groups.set(t.vehicleId, g);
    }
    const rows = [...groups.entries()].map(([id, g]) => ({
      id,
      alias: this.names().get(id) ?? 'Vehículo desconocido',
      ...g,
      net: g.income - g.expense,
    }));
    const maxIncome = Math.max(1, ...rows.map((r) => r.income));
    return rows.sort((a, b) => b.net - a.net).map((r) => ({ ...r, incomeShare: (r.income / maxIncome) * 100 }));
  });

  /** Desglose por día con sus movimientos. */
  days = computed(() => {
    const map = new Map<
      string,
      { key: string; date: Date; income: number; expense: number; balance: number; items: (Transaction & { vehicleAlias: string })[] }
    >();
    for (const t of this.filtered()) {
      const date = parseTxDate(t.date);
      const key = dayKey(date);
      const entry = map.get(key) ?? { key, date, income: 0, expense: 0, balance: 0, items: [] };
      if (t.type === 'income') {
        entry.income += t.amount;
        entry.balance += t.amount;
      } else {
        entry.expense += t.amount;
        entry.balance -= t.amount;
      }
      entry.items.push({ ...t, vehicleAlias: this.names().get(t.vehicleId) ?? 'Vehículo desconocido' });
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  toggleDay(key: string) {
    this.expandedDays.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---- Formato ----
  dayLabel = dayLabel;
  timeLabel(date: string) {
    return timeLabel(parseTxDate(date));
  }

  // ---- Exportar ----
  async exportCsv() {
    const rows = this.filtered();
    if (rows.length === 0) {
      this.toast.show('No hay registros en este periodo para exportar.');
      return;
    }
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Fecha', 'Hora', 'Tipo', 'Vehículo', 'Concepto', 'Monto'].map(esc).join(',')];
    for (const t of [...rows].reverse()) {
      const d = parseTxDate(t.date);
      lines.push(
        [
          format(d, 'yyyy-MM-dd'),
          format(d, 'HH:mm'),
          t.type === 'income' ? 'Ingreso' : 'Gasto',
          this.names().get(t.vehicleId) ?? 'Vehículo desconocido',
          t.description ?? '',
          t.amount.toFixed(2),
        ]
          .map(esc)
          .join(',')
      );
    }
    // BOM para que Excel respete los acentos
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const fileName = `mi-flota-${this.startDate()}_${this.endDate()}.csv`;
    const file = new File([blob], fileName, { type: 'text/csv' });

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Reporte de Mi Flota' });
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // el usuario cerró el panel de compartir
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Reporte descargado.');
  }
}
