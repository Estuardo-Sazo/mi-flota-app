import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { format } from 'date-fns';

export interface TransactionData {
  vehicleId: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
}

@Component({
  selector: 'app-transaction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-modal.component.html',
  styleUrls: ['./transaction-modal.component.css']
})
export class TransactionModalComponent {
  @Input() vehicleId: number | null = null;
  @Input() type: 'income' | 'expense' | null = null;
  @Input() vehicleAlias: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<TransactionData>();

  amount = signal<number | null>(null);
  description = signal('');
  // Usar fecha local (no UTC) para evitar desfase - se formatea con date-fns en zona local
  date = signal(format(new Date(), 'yyyy-MM-dd'));

  onSave() {
    if (this.vehicleId && this.type && this.amount() !== null && this.description()) {
      this.save.emit({
        vehicleId: this.vehicleId,
        type: this.type,
        amount: this.amount()!,
        description: this.description(),
        date: this.date()
      });
      this.resetForm();
    }
  }

  onClose() {
    this.close.emit();
    this.resetForm();
  }

  private resetForm() {
    this.amount.set(null);
    this.description.set('');
  this.date.set(format(new Date(), 'yyyy-MM-dd'));
  }
}
