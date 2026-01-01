import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { DatabaseService, Transaction } from '../../services/database.service';
import { liveQuery } from 'dexie';
import { startOfMonth, endOfMonth, format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private db = inject(DatabaseService);

  transactions = signal<Transaction[]>([]);
  currencySymbol = signal('$');
  selectedMonth = signal<Date>(startOfMonth(new Date()));

  currentMonthTransactions = computed(() => {
    const month = this.selectedMonth();
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return this.transactions().filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= start && tDate <= end;
    });
  });

  monthlyIncome = computed(() =>
    this.currentMonthTransactions()
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  monthlyExpenses = computed(() =>
    this.currentMonthTransactions()
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  netEarnings = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  recentTransactions = computed(() =>
    this.transactions()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  );

  dailySummaries = computed(() => {
    const dailyMap = new Map<
      string,
      { date: Date; income: number; expense: number; balance: number }
    >();

    this.currentMonthTransactions().forEach((t) => {
      const dateObj = new Date(t.date);
      const dayKey = format(dateObj, 'yyyy-MM-dd'); // Group by day

      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { date: dateObj, income: 0, expense: 0, balance: 0 });
      }

      const summary = dailyMap.get(dayKey)!;
      if (t.type === 'income') {
        summary.income += t.amount;
        summary.balance += t.amount;
      } else {
        summary.expense += t.amount;
        summary.balance -= t.amount;
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  ngOnInit() {
    liveQuery(() => this.db.transactions.toArray()).subscribe((transactions) => {
      this.transactions.set(transactions);
    });
    liveQuery(() => this.db.settings.get('currencySymbol')).subscribe((setting) => {
      if (setting) {
        this.currencySymbol.set(setting.value);
      }
    });
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString('es-ES');
  }

  monthLabel() {
    return format(this.selectedMonth(), 'MMMM yyyy', { locale: es });
  }

  prevMonth() {
    this.selectedMonth.set(startOfMonth(addMonths(this.selectedMonth(), -1)));
  }

  nextMonth() {
    const currentStart = startOfMonth(new Date());
    const next = startOfMonth(addMonths(this.selectedMonth(), 1));
    // Evitar avanzar más allá del mes actual
    if (next <= currentStart) {
      this.selectedMonth.set(next);
    }
  }

  isCurrentMonth() {
    return startOfMonth(new Date()).getTime() === this.selectedMonth().getTime();
  }
}
