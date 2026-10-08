import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { subDays } from 'date-fns';
import { SettingsService } from '../../services/settings.service';
import { TransactionService } from '../../services/transaction.service';
import { VehicleService } from '../../services/vehicle.service';
import { toDateTimeInput } from '../../utils/dates';

export interface TransactionData {
  vehicleId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
}

type TxType = 'income' | 'expense';

const DEFAULT_CONCEPT: Record<TxType, string> = { income: 'Viaje', expense: 'Gasolina' };

@Component({
  selector: 'app-transaction-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './transaction-modal.component.html',
  styleUrls: ['./transaction-modal.component.css'],
})
export class TransactionModalComponent implements OnInit, AfterViewInit {
  private settingsService = inject(SettingsService);
  private vehicleService = inject(VehicleService);
  private transactionService = inject(TransactionService);

  currencySymbol = computed(() => this.settingsService.settings().currencySymbol);
  vehicles = this.vehicleService.activeVehicles;

  /** Valores iniciales; dentro del panel se pueden cambiar. */
  @Input() vehicleId: string | null = null;
  @Input() type: TxType | null = null;
  @Input() defaultDescription: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<TransactionData>();

  selectedType = signal<TxType>('income');
  selectedVehicleId = signal<string | null>(null);
  amount = signal<number | null>(null);
  description = signal('');
  // Fecha local (no UTC) para evitar desfase de zona horaria
  date = signal(toDateTimeInput(new Date()));

  private amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');

  /** Conceptos sugeridos: los de siempre (Viaje/Gasolina) y los más usados por el usuario. */
  concepts = computed(() => {
    const type = this.selectedType();
    const counts = new Map<string, { label: string; count: number }>();
    for (const tx of this.transactionService.transactions()) {
      const label = tx.description?.trim();
      if (tx.type !== type || !label) continue;
      const key = label.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { label, count: 1 });
    }
    const top = [...counts.values()].sort((a, b) => b.count - a.count).map((e) => e.label);
    const unique = new Map<string, string>();
    for (const label of [DEFAULT_CONCEPT[type], ...top]) unique.set(label.toLowerCase(), label);
    return [...unique.values()].slice(0, 6);
  });

  canSave = computed(
    () => !!this.selectedVehicleId() && (this.amount() ?? 0) > 0 && this.description().trim().length > 0
  );

  ngOnInit() {
    const type = this.type ?? 'income';
    this.selectedType.set(type);
    this.selectedVehicleId.set(this.vehicleId ?? this.vehicleService.mostRecentVehicle()?.id ?? null);
    this.description.set(this.defaultDescription ?? DEFAULT_CONCEPT[type]);
  }

  ngAfterViewInit() {
    // En iOS el teclado solo se abre con un toque directo; en Android/escritorio sí se enfoca.
    queueMicrotask(() => this.amountInput()?.nativeElement.focus());
  }

  setType(type: TxType) {
    const previous = this.selectedType();
    if (previous === type) return;
    // Si el concepto era el predeterminado del tipo anterior (o estaba vacío), cambiarlo al del nuevo tipo.
    const current = this.description().trim();
    if (!current || current.toLowerCase() === DEFAULT_CONCEPT[previous].toLowerCase()) {
      this.description.set(DEFAULT_CONCEPT[type]);
    }
    this.selectedType.set(type);
  }

  setDate(which: 'now' | 'yesterday') {
    const now = new Date();
    this.date.set(toDateTimeInput(which === 'now' ? now : subDays(now, 1)));
  }

  onSave() {
    if (!this.canSave()) return;
    this.save.emit({
      vehicleId: this.selectedVehicleId()!,
      type: this.selectedType(),
      amount: this.amount()!,
      description: this.description().trim(),
      date: this.date(),
    });
  }

  onClose() {
    this.close.emit();
  }
}
