import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-ep-request-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ep-modal-overlay" (click)="close.emit()">
      <div class="ep-modal-card" (click)="$event.stopPropagation()">
        <div class="ep-modal-header">
          <h2>Edit EP Request</h2>
          <button type="button" class="icon-btn" (click)="close.emit()">x</button>
        </div>

        <div class="ep-modal-body">
          <label class="field">
            <span>Requester</span>
            <input [(ngModel)]="formData.requester" type="text">
          </label>
          <label class="field">
            <span>Department</span>
            <input [(ngModel)]="formData.department" type="text">
          </label>
          <label class="field">
            <span>Title</span>
            <input [(ngModel)]="formData.title" type="text">
          </label>
          <label class="field">
            <span>Vendor</span>
            <input [(ngModel)]="formData.vendor" type="text">
          </label>
          <label class="field">
            <span>Amount</span>
            <input [(ngModel)]="formData.amount" type="number" min="0">
          </label>
          <label class="field">
            <span>Priority</span>
            <select [(ngModel)]="formData.priority">
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </label>
          <label class="field full">
            <span>Description</span>
            <textarea [(ngModel)]="formData.description" rows="4"></textarea>
          </label>
          <label class="field full">
            <span>Objective</span>
            <textarea [(ngModel)]="formData.objective" rows="3"></textarea>
          </label>
        </div>

        <div class="ep-modal-footer">
          <button type="button" class="secondary-btn" (click)="close.emit()">Cancel</button>
          <button type="button" class="primary-btn" (click)="saveChanges()">Save Changes</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ep-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:24px;z-index:1000}
    .ep-modal-card{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.24)}
    .ep-modal-header,.ep-modal-footer{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e2e8f0}
    .ep-modal-footer{border-bottom:none;border-top:1px solid #e2e8f0;justify-content:flex-end;gap:12px}
    .ep-modal-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:24px}
    .field{display:flex;flex-direction:column;gap:8px;color:#0f172a;font-weight:600}
    .field input,.field select,.field textarea{width:100%;padding:13px 14px;border:1px solid #cbd5e1;border-radius:14px;font:inherit;color:#1e293b;background:#fff}
    .field.full{grid-column:1 / -1}
    .icon-btn,.secondary-btn,.primary-btn{border:none;border-radius:12px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer}
    .icon-btn{background:#eef2ff;color:#1e3a8a;padding:10px 14px}
    .secondary-btn{background:#e2e8f0;color:#0f172a}
    .primary-btn{background:#2563eb;color:#fff}
    @media (max-width: 720px){.ep-modal-body{grid-template-columns:1fr}}
  `]
})
export class EditEPRequestModalComponent implements OnChanges {
  @Input() request: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  formData: any = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request']) {
      this.formData = {
        ...this.request,
        amount: this.request?.amount ?? 0,
        priority: this.request?.priority || 'Medium',
        description: this.request?.description || '',
        objective: this.request?.objective || ''
      };
    }
  }

  saveChanges(): void {
    this.save.emit({ ...this.request, ...this.formData });
  }
}
