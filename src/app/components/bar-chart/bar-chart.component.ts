import { Component, computed, input } from '@angular/core';

export interface ChartPoint {
  label: string;
  income: number;
  expense: number;
  /** Resalta la barra (p. ej. el día de hoy). */
  highlight?: boolean;
}

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 10, bottom: 24, left: 4, right: 4 };

/** Gráfica de barras agrupadas (ingresos vs gastos) en SVG, sin librerías externas. */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      class="w-full h-auto block"
      role="img"
      [attr.aria-label]="summary()"
    >
      <!-- líneas guía -->
      <line [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="baseline" [attr.y2]="baseline" stroke="var(--color-border-strong)" stroke-width="1" />
      <line [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="pad.top" [attr.y2]="pad.top" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3 4" />

      @for (bar of bars(); track bar.index) {
        <g>
          <title>{{ bar.title }}</title>
          @if (bar.highlight) {
            <rect [attr.x]="bar.groupX + 1" [attr.y]="pad.top" [attr.width]="bar.groupW - 2" [attr.height]="baseline - pad.top" rx="6" fill="var(--color-surface-alt)" />
          }
          <rect [attr.x]="bar.incomeX" [attr.y]="bar.incomeY" [attr.width]="bar.barW" [attr.height]="bar.incomeH" rx="3" fill="var(--color-success)" />
          <rect [attr.x]="bar.expenseX" [attr.y]="bar.expenseY" [attr.width]="bar.barW" [attr.height]="bar.expenseH" rx="3" fill="var(--color-danger)" />
          @if (bar.showLabel) {
            <text [attr.x]="bar.centerX" [attr.y]="height - 7" text-anchor="middle" font-size="11" [attr.fill]="bar.highlight ? 'var(--color-text)' : 'var(--color-text-muted)'" [attr.font-weight]="bar.highlight ? 600 : 400">{{ bar.label }}</text>
          }
        </g>
      }
    </svg>
  `,
})
export class BarChartComponent {
  data = input.required<ChartPoint[]>();

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly pad = PAD;
  readonly baseline = HEIGHT - PAD.bottom;

  private max = computed(() => Math.max(1, ...this.data().flatMap((p) => [p.income, p.expense])));

  summary = computed(() => {
    const d = this.data();
    const income = d.reduce((s, p) => s + p.income, 0);
    const expense = d.reduce((s, p) => s + p.expense, 0);
    return `Gráfica de ingresos y gastos. Total ingresos ${income.toFixed(2)}, total gastos ${expense.toFixed(2)}.`;
  });

  bars = computed(() => {
    const d = this.data();
    const n = d.length || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const groupW = innerW / n;
    const barW = Math.max(3, Math.min(16, groupW * 0.32));
    const chartH = this.baseline - PAD.top;
    const every = Math.ceil(n / 8);
    return d.map((p, index) => {
      const groupX = PAD.left + index * groupW;
      const centerX = groupX + groupW / 2;
      const incomeH = p.income > 0 ? Math.max(2, (p.income / this.max()) * chartH) : 0;
      const expenseH = p.expense > 0 ? Math.max(2, (p.expense / this.max()) * chartH) : 0;
      return {
        index,
        label: p.label,
        highlight: !!p.highlight,
        showLabel: index % every === 0 || index === n - 1,
        title: `${p.label}: ingresos ${p.income.toFixed(2)}, gastos ${p.expense.toFixed(2)}`,
        groupX,
        groupW,
        centerX,
        barW,
        incomeX: centerX - barW - 1,
        incomeH,
        incomeY: this.baseline - incomeH,
        expenseX: centerX + 1,
        expenseH,
        expenseY: this.baseline - expenseH,
      };
    });
  });
}
