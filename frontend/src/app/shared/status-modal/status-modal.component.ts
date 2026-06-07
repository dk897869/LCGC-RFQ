import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth';

export interface StatusSummary {
  approved: number;
  pending: number;
  rejected: number;
  inProcess?: number;
  total?: number;
}

@Component({
  selector: 'app-status-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-modal.component.html',
  styleUrls: ['./status-modal.component.scss']
})
export class StatusModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Approval Status';
  @Input() requestType: string = 'all';
  @Input() summary: StatusSummary | null = null;
  @Output() closed = new EventEmitter<void>();

  isLoading = false;
  loadedSummary: StatusSummary = { approved: 0, pending: 0, rejected: 0, inProcess: 0, total: 0 };

  constructor(private authService: AuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.loadSummary();
    }
    if (this.summary) {
      this.loadedSummary = { ...this.summary };
    }
  }

  loadSummary(): void {
    if (this.summary) {
      this.loadedSummary = { ...this.summary };
      return;
    }
    this.isLoading = true;
    this.authService.getStatusSummary(this.requestType).subscribe({
      next: (res: any) => {
        const s = res?.data || res?.summary || res;
        this.loadedSummary = {
          approved: s.approved ?? 0,
          pending: s.pending ?? 0,
          rejected: s.rejected ?? 0,
          inProcess: s.inProcess ?? s.in_process ?? 0,
          total: s.total ?? (Number(s.approved || 0) + Number(s.pending || 0) + Number(s.rejected || 0))
        };
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}
