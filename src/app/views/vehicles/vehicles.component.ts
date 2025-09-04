import { Component, OnInit, signal, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseService, Vehicle } from '../../services/database.service';
import { liveQuery } from 'dexie';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicles.component.html',
  styleUrls: ['./vehicles.component.css']
})
export class VehiclesComponent implements OnInit {
  @Output() requestTransaction = new EventEmitter<{ vehicleId: number, type: 'income' | 'expense', vehicleAlias: string }>();
  @Output() addVehicle = new EventEmitter<void>();
  @Output() editVehicle = new EventEmitter<Vehicle>();
  
  private db = inject(DatabaseService);
  vehicles = signal<Vehicle[]>([]);

  ngOnInit() {
    liveQuery(() => this.db.vehicles.toArray()).subscribe(vehicles => {
      this.vehicles.set(vehicles);
    });
  }

  addTransaction(vehicle: Vehicle, type: 'income' | 'expense') {
    if (vehicle.id) {
      this.requestTransaction.emit({ vehicleId: vehicle.id, type, vehicleAlias: vehicle.alias });
    }
  }

  openAddVehicleModal() {
    this.addVehicle.emit();
  }

  startEdit(vehicle: Vehicle) {
    this.editVehicle.emit(vehicle);
  }
}