import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncStatusService } from '../../services/sync-status.service';

@Component({
  selector: 'app-sync-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sync-badge.component.html',
  styleUrls: ['./sync-badge.component.css']
})
export class SyncBadgeComponent {
  syncStatus = inject(SyncStatusService);

  readonly labels: Record<string, string> = {
    synced: 'Sincronizado',
    syncing: 'Sincronizando…',
    offline: 'Sin conexión'
  };
}
