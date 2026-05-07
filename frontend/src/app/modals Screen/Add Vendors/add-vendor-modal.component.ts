// add-vendor-modal.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-vendor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Add New Vendor</h2>
          <button class="close-btn" (click)="closeModal()">✕</button>
        </div>
        <form (ngSubmit)="saveVendor()">
          <div class="form-group">
            <label>Vendor Name</label>
            <input type="text" [(ngModel)]="vendor.name" name="name" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="vendor.email" name="email" required>
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="text" [(ngModel)]="vendor.phone" name="phone">
          </div>
          <div class="form-group">
            <label>Company</label>
            <input type="text" [(ngModel)]="vendor.company" name="company">
          </div>
          <div class="modal-actions">
            <button type="button" class="cancel-btn" (click)="closeModal()">Cancel</button>
            <button type="submit" class="save-btn" [disabled]="isLoading">
              {{ isLoading ? 'Adding...' : 'Add Vendor' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .modal-content { background: white; width: 420px; border-radius: 16px; padding: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h2 { margin: 0; color: #1e2937; }
    .close-btn { background: none; border: none; font-size: 1.6rem; cursor: pointer; color: #64748b; }
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; margin-bottom: 6px; font-weight: 600; }
    .form-group input { width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; }
    .modal-actions { display: flex; gap: 12px; margin-top: 25px; }
    .cancel-btn, .save-btn { flex: 1; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .cancel-btn { background: #f1f5f9; color: #475569; border: none; }
    .save-btn { background: #1e40af; color: white; border: none; }
  `]
})
export class AddVendorModalComponent {
  @Output() close = new EventEmitter<void>();
  vendor = { name: '', email: '', phone: '', company: '' };
  isLoading = false;

  closeModal() { this.close.emit(); }

  saveVendor() {
    if (!this.vendor.name || !this.vendor.email) return alert("Name and Email required");
    this.isLoading = true;
    setTimeout(() => {
      alert(`Vendor "${this.vendor.name}" added successfully!`);
      this.isLoading = false;
      this.closeModal();
    }, 800);
  }
}