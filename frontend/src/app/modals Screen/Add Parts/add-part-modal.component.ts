// add-part-modal.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-part-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Add New Part</h2>
          <button class="close-btn" (click)="closeModal()">✕</button>
        </div>
        <form (ngSubmit)="savePart()">
          <div class="form-group">
            <label>Part Name</label>
            <input type="text" [(ngModel)]="part.name" name="name" required>
          </div>
          <div class="form-group">
            <label>Part Number</label>
            <input type="text" [(ngModel)]="part.partNumber" name="partNumber" required>
          </div>
          <div class="form-group">
            <label>Category</label>
            <input type="text" [(ngModel)]="part.category" name="category">
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" [(ngModel)]="part.quantity" name="quantity" min="1">
          </div>
          <div class="modal-actions">
            <button type="button" class="cancel-btn" (click)="closeModal()">Cancel</button>
            <button type="submit" class="save-btn" [disabled]="isLoading">
              {{ isLoading ? 'Adding...' : 'Add Part' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [` /* Same styles as vendor modal */ `]
})
export class AddPartModalComponent {
  @Output() close = new EventEmitter<void>();
  part = { name: '', partNumber: '', category: '', quantity: 1 };
  isLoading = false;

  closeModal() { this.close.emit(); }

  savePart() {
    if (!this.part.name || !this.part.partNumber) return alert("Part Name and Number required");
    this.isLoading = true;
    setTimeout(() => {
      alert(`Part "${this.part.name}" added successfully!`);
      this.isLoading = false;
      this.closeModal();
    }, 700);
  }
}