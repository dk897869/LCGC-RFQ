// po-npp.component.ts (corrected)
import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PoLineItem {
  id: number;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  netAmount: number;
  deliveryDate: string;
}

export interface PurchaseOrderData {
  poNumber?: string;
  poDate: string;
  vendorId: string;
  vendorName: string;
  vendorGst: string;
  vendorAddress: string;
  shippingAddress: string;
  billingAddress: string;
  paymentTerms: string;
  deliveryTerms: string;
  deliveryDate: string;
  items: PoLineItem[];
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  grandTotal: number;
  currency: string;
  attachedPrRef: string;
  approvedBy: string;
  status: 'draft' | 'issued' | 'acknowledged' | 'shipped' | 'delivered' | 'cancelled';
  specialNotes: string;
}

@Component({
  selector: 'app-po-npp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './po-npp.html',
  styleUrls: ['./po-npp.scss']
})
export class PoNpp {
  @Output() onSubmit = new EventEmitter<any>();
  @Input() preFillFromRfq?: any;

  today: string = new Date().toISOString().split('T')[0];

  poData: PurchaseOrderData = {
    poDate: this.today,
    vendorId: '',
    vendorName: '',
    vendorGst: '',
    vendorAddress: '',
    shippingAddress: '',
    billingAddress: '',
    paymentTerms: 'Net 30 Days',
    deliveryTerms: 'FOB Destination',
    deliveryDate: '',
    items: [
      { id: 1, itemCode: '', description: '', quantity: 1, uom: 'Pcs', unitPrice: 0, totalPrice: 0, taxRate: 18, taxAmount: 0, discount: 0, netAmount: 0, deliveryDate: '' }
    ],
    subtotal: 0,
    totalTax: 0,
    totalDiscount: 0,
    grandTotal: 0,
    currency: 'INR',
    attachedPrRef: '',
    approvedBy: '',
    status: 'draft',
    specialNotes: ''
  };

  paymentTermsList = ['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Advance 50%', 'LC at Sight', 'COD'];
  deliveryTermsList = ['FOB Origin', 'FOB Destination', 'CIF', 'Ex-Works', 'Door Delivery'];
  taxRates = [0, 5, 12, 18, 28];
  statusList = ['draft', 'issued', 'acknowledged', 'shipped', 'delivered', 'cancelled'];

  isSubmitting = false;
  showErrors = false;

  // FIX: Changed from getter to method
  calculateTotals(): void {
    this.poData.subtotal = this.poData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    this.poData.totalTax = this.poData.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    this.poData.totalDiscount = this.poData.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    this.poData.grandTotal = this.poData.subtotal + this.poData.totalTax - this.poData.totalDiscount;
  }

  updateItemCalculations(item: PoLineItem): void {
    item.totalPrice = item.quantity * item.unitPrice;
    item.taxAmount = item.totalPrice * (item.taxRate / 100);
    item.netAmount = item.totalPrice + item.taxAmount - (item.discount || 0);
    this.calculateTotals(); // Call the method instead
  }

  addItem(): void {
    const newId = Math.max(...this.poData.items.map(i => i.id), 0) + 1;
    this.poData.items.push({
      id: newId,
      itemCode: '',
      description: '',
      quantity: 1,
      uom: 'Pcs',
      unitPrice: 0,
      totalPrice: 0,
      taxRate: 18,
      taxAmount: 0,
      discount: 0,
      netAmount: 0,
      deliveryDate: ''
    });
  }

  removeItem(index: number): void {
    if (this.poData.items.length > 1) {
      this.poData.items.splice(index, 1);
      this.calculateTotals(); // Call the method here too
    }
  }

  validateForm(): boolean {
    if (!this.poData.vendorName.trim()) return false;
    if (!this.poData.shippingAddress.trim()) return false;
    if (!this.poData.deliveryDate) return false;
    for (const item of this.poData.items) {
      if (!item.description.trim()) return false;
      if (item.quantity <= 0) return false;
    }
    return true;
  }

  submitPo(): void {
    this.showErrors = true;
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.poData.poNumber = poNumber;
    this.poData.status = 'issued';

    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        type: 'Purchase Order',
        serialNo: poNumber,
        data: this.poData
      });
      this.resetForm();
    }, 800);
  }

  resetForm(): void {
    this.poData = {
      poDate: this.today,
      vendorId: '',
      vendorName: '',
      vendorGst: '',
      vendorAddress: '',
      shippingAddress: '',
      billingAddress: '',
      paymentTerms: 'Net 30 Days',
      deliveryTerms: 'FOB Destination',
      deliveryDate: '',
      items: [
        { id: 1, itemCode: '', description: '', quantity: 1, uom: 'Pcs', unitPrice: 0, totalPrice: 0, taxRate: 18, taxAmount: 0, discount: 0, netAmount: 0, deliveryDate: '' }
      ],
      subtotal: 0,
      totalTax: 0,
      totalDiscount: 0,
      grandTotal: 0,
      currency: 'INR',
      attachedPrRef: '',
      approvedBy: '',
      status: 'draft',
      specialNotes: ''
    };
    this.showErrors = false;
  }
}