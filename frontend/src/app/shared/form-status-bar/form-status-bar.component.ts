import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-form-status-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-status-bar.component.html',
  styleUrls: ['./form-status-bar.component.scss']
})
export class FormStatusBarComponent {
  @Input() status: string = 'Pending';
  @Input() showActions = false;
  @Input() canApprove = false;
  @Output() checkStatus = new EventEmitter<void>();
  @Output() approve = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();

  get statusClass(): string {
    const s = (this.status || '').toLowerCase();
    if (s.includes('approve')) return 'fsb-approved';
    if (s.includes('reject')) return 'fsb-rejected';
    if (s.includes('process')) return 'fsb-inprocess';
    return 'fsb-pending';
  }
}
