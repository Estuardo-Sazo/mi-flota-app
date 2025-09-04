import { Component, Output, EventEmitter, signal, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vehicle } from '../../services/database.service';

@Component({
  selector: 'app-add-vehicle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-vehicle-modal.component.html',
  styleUrls: ['./add-vehicle-modal.component.css']
})
export class AddVehicleModalComponent implements OnChanges {
  @Input() vehicle: Vehicle | null = null; // null -> modo añadir, con valor -> modo edición
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ alias: string, placa: string }>();
  @Output() update = new EventEmitter<{ id: number, alias: string, placa: string }>();

  alias = signal('');
  placa = signal('');

  ngOnChanges(changes: SimpleChanges) {
    if (changes['vehicle'] && this.vehicle) {
      // Precargar datos para edición
      this.alias.set(this.vehicle.alias);
      this.placa.set(this.vehicle.placa);
    }
  }

  onPrimaryAction() {
    if (!this.alias().trim() || !this.placa().trim()) return;
    const alias = this.alias().trim();
    const placa = this.placa().trim();
    if (this.vehicle && this.vehicle.id != null) {
      this.update.emit({ id: this.vehicle.id, alias, placa });
    } else {
      this.save.emit({ alias, placa });
    }
    this.resetForm();
  }

  onClose() {
    this.close.emit();
    this.resetForm();
  }

  private resetForm() {
    this.alias.set('');
    this.placa.set('');
  this.vehicle = null;
  }
}
