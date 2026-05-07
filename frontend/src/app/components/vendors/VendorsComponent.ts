import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

interface VendorRecord {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  gstNumber: string;
  address: string;
  status: string;
}

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './VendorsComponent.html',
  styleUrls: ['./VendorsComponent.scss']
})
export class VendorsComponent implements OnInit {
  vendors: VendorRecord[] = [];
  isLoading = false;
  showModal = false;
  isEditing = false;
  formSubmitting = false;
  selectedVendorId = '';
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  formData: VendorRecord = this.getEmptyVendor();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadVendors();
  }

  get activeCount(): number {
    return this.vendors.filter(v => (v.status || 'Active') === 'Active').length;
  }

  getEmptyVendor(): VendorRecord {
    return {
      name: '',
      email: '',
      phone: '',
      company: '',
      gstNumber: '',
      address: '',
      status: 'Active'
    };
  }

  loadVendors(): void {
    this.isLoading = true;
    this.authService.getVendors().subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.vendors = Array.isArray(data) ? data.map((item: any) => ({
          id: item.id || item._id,
          _id: item._id || item.id,
          name: item.name || item.vendorName || 'Unnamed Vendor',
          email: item.email || '',
          phone: item.phone || item.contactNo || '',
          company: item.company || item.companyName || '',
          gstNumber: item.gstNumber || item.gst || '',
          address: item.address || '',
          status: item.status || 'Active'
        })) : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('error', err?.message || 'Failed to load vendors.');
      }
    });
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.selectedVendorId = '';
    this.formData = this.getEmptyVendor();
    this.showModal = true;
  }

  openEditModal(vendor: VendorRecord): void {
    this.isEditing = true;
    this.selectedVendorId = vendor.id || vendor._id || '';
    this.formData = { ...vendor };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.formSubmitting = false;
  }

  submitVendor(): void {
    if (!this.formData.name.trim() || !this.formData.email.trim()) {
      this.showToast('error', 'Vendor name and email are required.');
      return;
    }

    const payload = {
      name: this.formData.name.trim(),
      email: this.formData.email.trim().toLowerCase(),
      phone: this.formData.phone.trim(),
      company: this.formData.company.trim(),
      gstNumber: this.formData.gstNumber.trim(),
      address: this.formData.address.trim(),
      status: this.formData.status || 'Active'
    };

    this.formSubmitting = true;
    const request$ = this.isEditing && this.selectedVendorId
      ? this.authService.updateVendor(this.selectedVendorId, payload)
      : this.authService.addVendor(payload);

    request$.subscribe({
      next: () => {
        this.formSubmitting = false;
        this.showModal = false;
        this.showToast('success', this.isEditing ? 'Vendor updated successfully.' : 'Vendor added successfully.');
        this.loadVendors();
      },
      error: (err) => {
        this.formSubmitting = false;
        this.showToast('error', err?.message || 'Unable to save vendor.');
      }
    });
  }

  deleteVendor(vendor: VendorRecord): void {
    const id = vendor.id || vendor._id;
    if (!id || !confirm(`Delete vendor "${vendor.name}"?`)) return;

    this.authService.deleteVendor(id).subscribe({
      next: () => {
        this.showToast('success', 'Vendor deleted successfully.');
        this.vendors = this.vendors.filter(item => (item.id || item._id) !== id);
      },
      error: (err) => {
        this.showToast('error', err?.message || 'Failed to delete vendor.');
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
