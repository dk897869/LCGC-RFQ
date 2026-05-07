import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-view-ep-request-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ep-modal-overlay" (click)="close.emit()">
      <div class="ep-modal-card" (click)="$event.stopPropagation()">
        <div class="ep-modal-header">
          <div>
            <h2>{{ request?.title || 'EP Request Details' }}</h2>
            <p>{{ request?.requester || 'Unknown requester' }} • {{ request?.department || 'No department' }}</p>
          </div>
          <button type="button" class="icon-btn" (click)="close.emit()">x</button>
        </div>

        <div class="ep-modal-body">
          <div class="info-grid">
            <div class="info-item"><span>Status</span><strong>{{ request?.status || 'Pending' }}</strong></div>
            <div class="info-item"><span>Priority</span><strong>{{ request?.priority || 'Medium' }}</strong></div>
            <div class="info-item"><span>Vendor</span><strong>{{ request?.vendor || '—' }}</strong></div>
            <div class="info-item"><span>Amount</span><strong>{{ request?.amount || 0 | number }}</strong></div>
            <div class="info-item"><span>Email</span><strong>{{ request?.email || '—' }}</strong></div>
            <div class="info-item"><span>Contact</span><strong>{{ request?.contactNo || '—' }}</strong></div>
          </div>

          <div class="detail-block" *ngIf="request?.description">
            <span>Description</span>
            <p>{{ request?.description }}</p>
          </div>

          <div class="detail-block" *ngIf="request?.objective">
            <span>Objective</span>
            <p>{{ request?.objective }}</p>
          </div>

          <div class="detail-block" *ngIf="request?.stakeholders?.length">
            <span>Approval Chain</span>
            <div class="stakeholder-list">
              <div class="stakeholder" *ngFor="let stakeholder of request.stakeholders">
                <strong>{{ stakeholder.name }}</strong>
                <small>{{ stakeholder.designation }} • {{ stakeholder.status }}</small>
              </div>
            </div>
          </div>
        </div>

        <div class="ep-modal-footer">
          <button type="button" class="primary-btn" (click)="close.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ep-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:24px;z-index:1000}
    .ep-modal-card{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.24)}
    .ep-modal-header,.ep-modal-footer{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e2e8f0}
    .ep-modal-header p{margin:6px 0 0;color:#64748b}
    .ep-modal-footer{border-bottom:none;border-top:1px solid #e2e8f0;justify-content:flex-end}
    .ep-modal-body{display:flex;flex-direction:column;gap:18px;padding:24px}
    .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .info-item,.detail-block{padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc}
    .info-item span,.detail-block span{display:block;margin-bottom:8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
    .detail-block p{margin:0;color:#0f172a;line-height:1.6}
    .stakeholder-list{display:grid;gap:10px}
    .stakeholder{padding:12px 14px;border-radius:14px;background:#fff;border:1px solid #dbeafe}
    .stakeholder small{display:block;margin-top:4px;color:#64748b}
    .icon-btn,.primary-btn{border:none;border-radius:12px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer}
    .icon-btn{background:#eef2ff;color:#1e3a8a}
    .primary-btn{background:#2563eb;color:#fff;padding:12px 18px}
    @media (max-width: 720px){.info-grid{grid-template-columns:1fr}}
  `]
})
export class ViewEPRequestModalComponent {
  @Input() request: any = null;
  @Output() close = new EventEmitter<void>();
}
