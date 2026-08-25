import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
import { SettingsService } from '../../services/settings.service';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
})
export class ReportsComponent {
  private transactionService = inject(TransactionService);
  private settingsService = inject(SettingsService);

  transactions = this.transactionService.transactions;
  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);

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
