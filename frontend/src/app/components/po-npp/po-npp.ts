import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-po-npp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './po-npp.html',
  styleUrl: './po-npp.scss',
})
export class PoNpp implements OnInit {
  isSubmitting = false;
  toast: { type: 'success' | 'error' | 'info'; message: string } | null = null;
  submittedOrders: any[] = [];

  form = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    requestDate: new Date().toISOString().slice(0, 10),
    contactNo: '',
    organization: 'Radiant Appliances',
    titleOfActivity: 'Purchase Order Request',
    purposeAndObjective: '',
    priority: 'M',
    vendorCode: '',
    vendorName: '',
    vendorAddress: '',
    vendorGst: '',
    vendorContact: '',
    vendorEmail: '',
    vendorKindAttn: '',
    orderNo: '',
    orderDate: new Date().toISOString().slice(0, 10),
    quotRef: '',
    prNo: '',
    prDate: '',
    purchaser: '',
    purchaserMobile: '',
    billingAddress: 'Radiant Appliances and Electronics Pvt. Ltd.',
    billingGst: '',
    shippingAddress: 'Radiant Appliances and Electronics Pvt. Ltd.',
    shippingGst: '',
    transporter: '',
    taxes: 'GST extra as applicable',
    terms: 'Delivery as per agreed schedule. Payment as per commercial terms.',
    remarks: ''
  };

  items = [
    { partNo: '', itemDescription: '', hsn: '', uom: 'Pcs', quantity: 1, rate: 0, discount: 0, gst: 18, deliveryDate: '', remark: '' }
  ];

  stakeholders = [
    { line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', remarks: '' }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user) {
      this.form.requesterName = user.name || '';
      this.form.emailId = user.email || '';
      this.form.contactNo = user.contactNo || '';
      this.form.organization = user.organization || this.form.organization;
      this.form.purchaser = user.name || '';
    }
  }

  get totalAmount(): number {
    return this.items.reduce((sum, item) => {
      const base = Number(item.quantity || 0) * Number(item.rate || 0);
      const afterDiscount = base - (base * Number(item.discount || 0) / 100);
      return sum + afterDiscount + (afterDiscount * Number(item.gst || 0) / 100);
    }, 0);
  }

  get pendingApprovals(): number {
    return this.stakeholders.filter(item => item.status === 'Pending').length;
  }

  addItem(): void {
    this.items.push({ partNo: '', itemDescription: '', hsn: '', uom: 'Pcs', quantity: 1, rate: 0, discount: 0, gst: 18, deliveryDate: '', remark: '' });
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.splice(index, 1);
  }

  addApprover(): void {
    this.stakeholders.push({ line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', remarks: '' });
  }

  removeApprover(index: number): void {
    if (this.stakeholders.length > 1) this.stakeholders.splice(index, 1);
  }

  submit(): void {
    if (!this.form.requesterName || !this.form.emailId || !this.form.vendorName || !this.items[0].itemDescription) {
      this.showToast('error', 'Please fill requester, email, vendor and at least one item.');
      return;
    }

    this.isSubmitting = true;
    const payload = {
      ...this.form,
      amount: this.totalAmount,
      items: this.items,
      stakeholders: this.stakeholders.filter(item => item.managerName || item.email),
      terms: this.form.terms.split('\n').map(term => term.trim()).filter(Boolean),
      source: 'PO-NPP',
      status: 'Pending'
    };

    this.authService.createNppPoRequest(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const saved = res?.data || payload;
        this.submittedOrders = [{ ...saved, uniqueSerialNo: res?.serialNumber || saved.uniqueSerialNo || saved.orderNo }, ...this.submittedOrders].slice(0, 6);
        this.showToast('success', `PO submitted successfully${res?.serialNumber ? ' - ' + res.serialNumber : ''}.`);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showToast('error', err?.message || 'PO submission failed.');
      }
    });
  }

  private showToast(type: 'success' | 'error' | 'info', message: string): void {
    this.toast = { type, message };
    setTimeout(() => this.toast = null, 3500);
  }
}
