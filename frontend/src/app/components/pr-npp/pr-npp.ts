// pr-request.component.ts (corrected)
import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PrLineItem {
  id: number;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  estimatedPrice: number;
  totalAmount: number;
  deliveryDate: string;
  specs?: string;
}

export interface PrRequestData {
  prNumber?: string;
  requestDate: string;
  requesterName: string;
  department: string;
  costCenter: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  procurementType: 'goods' | 'services' | 'both';
  deliveryLocation: string;
  expectedDelivery: string;
  items: PrLineItem[];
  justifications: string;
  additionalNotes: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
}

@Component({
  selector: 'app-pr-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pr-npp.html',
  styleUrls: ['./pr-npp.scss']
})
export class PrRequest {
  @Output() onSubmit = new EventEmitter<any>();

  today: string = new Date().toISOString().split('T')[0];

  prData: PrRequestData = {
    requestDate: this.today,
    requesterName: '',
    department: 'Production',
    costCenter: 'CC-1001',
    priority: 'medium',
    procurementType: 'goods',
    deliveryLocation: 'Warehouse A, Plot No. 45, MIDC Area, Pune',
    expectedDelivery: '',
    items: [
      { id: 1, itemCode: '', description: '', quantity: 1, uom: 'Pcs', estimatedPrice: 0, totalAmount: 0, deliveryDate: '' }
    ],
    justifications: '',
    additionalNotes: '',
    status: 'draft'
  };

  departments = ['Production', 'Maintenance', 'Quality', 'R&D', 'Logistics', 'Administration', 'IT'];
  costCenters = ['CC-1001', 'CC-1002', 'CC-2001', 'CC-3005', 'CC-4008'];
  
  // FIX: Added proper typing for priorities
  priorities: Array<{ value: PrRequestData['priority']; label: string; class: string }> = [
    { value: 'low', label: 'Low', class: 'prio-low' },
    { value: 'medium', label: 'Medium', class: 'prio-med' },
    { value: 'high', label: 'High', class: 'prio-high' },
    { value: 'urgent', label: 'Urgent', class: 'prio-urgent' }
  ];
  
  procurementTypes = [
    { value: 'goods', label: 'Goods (Raw Materials/Components)' },
    { value: 'services', label: 'Services (Contract/Labour)' },
    { value: 'both', label: 'Both Goods & Services' }
  ];
  uomOptions = ['Pcs', 'Kg', 'Meters', 'Liters', 'Box', 'Set', 'Unit', 'Hour', 'Month'];

  isSubmitting = false;
  showValidationErrors = false;

  get totalEstimatedValue(): number {
    return this.prData.items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  }

  updateItemTotal(item: PrLineItem): void {
    item.totalAmount = item.quantity * item.estimatedPrice;
  }

  addItem(): void {
    const newId = Math.max(...this.prData.items.map(i => i.id), 0) + 1;
    this.prData.items.push({
      id: newId,
      itemCode: '',
      description: '',
      quantity: 1,
      uom: 'Pcs',
      estimatedPrice: 0,
      totalAmount: 0,
      deliveryDate: ''
    });
  }

  removeItem(index: number): void {
    if (this.prData.items.length > 1) {
      this.prData.items.splice(index, 1);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  validateForm(): boolean {
    if (!this.prData.requesterName.trim()) return false;
    if (!this.prData.expectedDelivery) return false;
    if (this.prData.items.length === 0) return false;
    for (const item of this.prData.items) {
      if (!item.description.trim()) return false;
      if (item.quantity <= 0) return false;
      if (item.estimatedPrice < 0) return false;
    }
    return true;
  }

  submitPr(): void {
    this.showValidationErrors = true;
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;
    const serialNo = `PR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.prData.prNumber = serialNo;
    this.prData.status = 'submitted';

    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        type: 'PR Request',
        serialNo: serialNo,
        data: this.prData
      });
      this.resetForm();
    }, 800);
  }

  resetForm(): void {
    this.prData = {
      requestDate: this.today,
      requesterName: '',
      department: 'Production',
      costCenter: 'CC-1001',
      priority: 'medium',
      procurementType: 'goods',
      deliveryLocation: 'Warehouse A, Plot No. 45, MIDC Area, Pune',
      expectedDelivery: '',
      items: [
        { id: 1, itemCode: '', description: '', quantity: 1, uom: 'Pcs', estimatedPrice: 0, totalAmount: 0, deliveryDate: '' }
      ],
      justifications: '',
      additionalNotes: '',
      status: 'draft'
    };
    this.showValidationErrors = false;
  }
}