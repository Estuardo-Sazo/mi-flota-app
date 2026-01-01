import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService, Transaction } from '../../services/database.service';
import { liveQuery } from 'dexie';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent implements OnInit {
  private db = inject(DatabaseService);

  transactions = signal<Transaction[]>([]);
  currencySymbol = signal('$');

  // Default to today
  startDate = signal(format(new Date(), 'yyyy-MM-dd'));
  endDate = signal(format(new Date(), 'yyyy-MM-dd'));

  filteredTransactions = computed(() => {
    const start = startOfDay(parseISO(this.startDate()));
    const end = endOfDay(parseISO(this.endDate()));

    return this.transactions().filter((t) => {
      const tDate = new Date(t.date);
      return isWithinInterval(tDate, { start, end });
    });
  });

  rangeSummary = computed(() => {
    const txs = this.filteredTransactions();
    const income = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = txs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return {
      income,
      expense,
      balance: income - expense,
    };
  });

  dailyBreakdown = computed(() => {
    const dailyMap = new Map<
      string,
      { date: Date; income: number; expense: number; balance: number }
    >();

    this.filteredTransactions().forEach((t) => {
      const dateObj = new Date(t.date);
      const dayKey = format(dateObj, 'yyyy-MM-dd');

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

  formatDate(dateStr: string) {
    // Handle ISO string or simple date string safely
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
