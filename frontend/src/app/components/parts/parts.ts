import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

interface PartRecord {
  id?: string;
  _id?: string;
  partCode: string;
  partNumber: string;
  description: string;
  price: number;
  location: string;
  quantity: number;
  category: string;
  manufacturer: string;
  status: string;
}

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parts.html',
  styleUrls: ['./parts.scss']
})
export class PartsComponent implements OnInit {
  parts: PartRecord[] = [];
  isLoading = false;
  showModal = false;
  isEditing = false;
  formSubmitting = false;
  selectedPartId = '';
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  formData: PartRecord = this.getEmptyPart();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadParts();
  }

  get activeCount(): number {
    return this.parts.filter(p => (p.status || 'Active') === 'Active').length;
  }

  getEmptyPart(): PartRecord {
    return {
      partCode: '',
      partNumber: '',
      description: '',
      price: 0,
      location: '',
      quantity: 0,
      category: '',
      manufacturer: '',
      status: 'Active'
    };
  }

  loadParts(): void {
    this.isLoading = true;
    this.authService.getParts().subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.parts = Array.isArray(data) ? data.map((item: any) => ({
          id: item.id || item._id,
          _id: item._id || item.id,
          partCode: item.partCode || item.code || '',
          partNumber: item.partNumber || item.number || '',
          description: item.description || item.name || 'Unnamed Part',
          price: Number(item.price || item.rate || 0),
          location: item.location || '',
          quantity: Number(item.quantity || item.stock || 0),
          category: item.category || '',
          manufacturer: item.manufacturer || item.mfr || '',
          status: item.status || 'Active'
        })) : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('error', err?.message || 'Failed to load parts.');
      }
    });
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.selectedPartId = '';
    this.formData = this.getEmptyPart();
    this.showModal = true;
  }

  openEditModal(part: PartRecord): void {
    this.isEditing = true;
    this.selectedPartId = part.id || part._id || '';
    this.formData = { ...part };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.formSubmitting = false;
  }

  submitPart(): void {
    if (!this.formData.partCode.trim() || !this.formData.description.trim()) {
      this.showToast('error', 'Part code and description are required.');
      return;
    }

    const payload = {
      partCode: this.formData.partCode.trim(),
      partNumber: this.formData.partNumber.trim(),
      description: this.formData.description.trim(),
      price: Number(this.formData.price || 0),
      location: this.formData.location.trim(),
      quantity: Number(this.formData.quantity || 0),
      category: this.formData.category.trim(),
      manufacturer: this.formData.manufacturer.trim(),
      status: this.formData.status || 'Active'
    };

    this.formSubmitting = true;
    const request$ = this.isEditing && this.selectedPartId
      ? this.authService.updatePart(this.selectedPartId, payload)
      : this.authService.addPart(payload);

    request$.subscribe({
      next: () => {
        this.formSubmitting = false;
        this.showModal = false;
        this.showToast('success', this.isEditing ? 'Part updated successfully.' : 'Part added successfully.');
        this.loadParts();
      },
      error: (err) => {
        this.formSubmitting = false;
        this.showToast('error', err?.message || 'Unable to save part.');
      }
    });
  }

  deletePart(part: PartRecord): void {
    const id = part.id || part._id;
    if (!id || !confirm(`Delete part "${part.partCode}"?`)) return;

    this.authService.deletePart(id).subscribe({
      next: () => {
        this.showToast('success', 'Part deleted successfully.');
        this.parts = this.parts.filter(item => (item.id || item._id) !== id);
      },
      error: (err) => {
        this.showToast('error', err?.message || 'Failed to delete part.');
      }
    });
  }

  showToast(type: 'success' | 'error' | 'info', message: string): void {
    this.toastType = type;
    this.toastMessage = message;
    setTimeout(() => {
      if (this.toastMessage === message) this.toastMessage = '';
    }, 3500);
  }
}
