import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { queueWrite } from '../../utils/queue-write';

@Component({
  selector: 'app-inactive-vehicles',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './inactive-vehicles.component.html',
})
export class InactiveVehiclesComponent {
  private vehicleService = inject(VehicleService);

  vehicles = this.vehicleService.inactiveVehicles;

  reactivate(id: string) {
    queueWrite(() => this.vehicleService.setActive(id, true));
  }
}
