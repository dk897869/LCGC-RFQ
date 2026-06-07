import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { StatusModalComponent } from '../../../shared/status-modal/status-modal.component';
import { FormStatusBarComponent } from '../../../shared/form-status-bar/form-status-bar.component';

interface PrItem {
  rfqNo: string;
  supplierName: string;
  partCode: string;
  partDescription: string;
  specification: string;
  cmdt: string;
  uom: string;
  qty: number;
  currency: string;
  unitPrice: number;
  totalValue: number;
}

interface ComparisonItem {
  partCode: string;
  description: string;
  qty: number;
  suppliers: { vendorId: number; vendorName: string; price: number; amount: number }[];
  lowestCostVendor?: { vendorId: number; vendorName: string; price: number } | null;
  selectedVendor?: string;
}

interface PrAttachment {
  name: string;
  size: string;
  remark: string;
  url?: string;
}

@Component({
  selector: 'app-pr-request',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusModalComponent, FormStatusBarComponent],
  templateUrl: './pr-request.html',
  styleUrls: ['./pr-request.scss'],
})
export class PrRequest implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  form = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    contactNo: '',
    organization: 'Radiant Appliances',
    requestDate: new Date().toISOString().split('T')[0],
    titleOfActivity: 'PR Process for Approval',
    purposeAndObjective: '',
    priority: 'H',
    departmentBudget: '₹ 15,00,000.00',
    balance: '₹ 15,00,000.00',
    costCenter: 'Purchase Department',
    alternativeCostCenter: '',
    rfqNo: '',
    status: 'Pending'
  };

  prSerialNo = '';
  prId = '';
  viewMode: 'create' | 'approval' = 'create';

  items: PrItem[] = [
    { rfqNo: '', supplierName: '', partCode: '', partDescription: '', specification: '', cmdt: '', uom: 'Nos', qty: 1, currency: 'INR', unitPrice: 0, totalValue: 0 }
  ];

  comparisonItems: ComparisonItem[] = [];
  comparisonMode: 'auto' | 'manual' = 'auto';
  recommendedVendor = '';
  supplierHeaders: string[] = ['Supplier 1', 'Supplier 2', 'Supplier 3'];

  approvers = [
    { line: 'Parallel', managerName: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager', status: 'Approved', remarks: '', dateTime: '07-Jun-26 09:30' },
    { line: 'Sequential', managerName: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP', status: 'Pending', remarks: '', dateTime: '' }
  ];

  attachments: PrAttachment[] = [];
  ccRecipients: string[] = [];
  ccInput = '';

  showStatusModal = false;
  statusSummary = { approved: 0, pending: 0, rejected: 0 };
  isSubmitting = false;
  isComparisonLoading = false;
  isAdmin = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user) {
      this.form.requesterName = user.name || '';
      this.form.emailId = user.email || '';
      this.form.department = user.department || 'Purchase';
      this.form.contactNo = user.contactNo || '';
      this.isAdmin = ['Admin', 'Manager', 'Senior Manager'].includes(user.role || '');
    }
    this.prSerialNo = `PR-DRAFT-${this.formatDraftDate()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    this.loadStatusSummary();
  }

  private formatDraftDate(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  loadStatusSummary(): void {
    this.authService.getStatusSummary('pr').subscribe({
      next: (res: any) => {
        const s = res?.data || res?.summary || {};
        this.statusSummary = { approved: s.approved ?? 0, pending: s.pending ?? 0, rejected: s.rejected ?? 0 };
      }
    });
  }

  openStatusModal(): void {
    this.loadStatusSummary();
    this.showStatusModal = true;
  }

  addItem(): void {
    this.items.push({ rfqNo: this.form.rfqNo, supplierName: '', partCode: '', partDescription: '', specification: '', cmdt: '', uom: 'Nos', qty: 1, currency: 'INR', unitPrice: 0, totalValue: 0 });
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.splice(index, 1);
  }

  calculateItem(item: PrItem): void {
    item.totalValue = Number(item.qty || 0) * Number(item.unitPrice || 0);
  }

  getTotalValue(): number {
    return this.items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0);
  }

  loadComparisonAuto(): void {
    this.comparisonMode = 'auto';
    this.isComparisonLoading = true;
    const id = this.prId || 'latest';
    this.authService.getPrComparison(id).subscribe({
      next: (res: any) => {
        this.isComparisonLoading = false;
        const data = res?.items ? res : res?.data || res;
        this.comparisonItems = data.items || [];
        this.recommendedVendor = data.recommendedVendor?.vendorName || '';
        if (data.rfqNo) this.form.rfqNo = data.rfqNo;
        this.syncSupplierHeaders();
        if (this.comparisonItems.length && !this.items[0]?.partCode) {
          this.items = this.comparisonItems.map((row) => ({
            rfqNo: this.form.rfqNo,
            supplierName: row.lowestCostVendor?.vendorName || row.selectedVendor || '',
            partCode: row.partCode,
            partDescription: row.description,
            specification: '',
            cmdt: '',
            uom: 'Nos',
            qty: row.qty,
            currency: 'INR',
            unitPrice: row.lowestCostVendor?.price || 0,
            totalValue: (row.lowestCostVendor?.price || 0) * row.qty
          }));
        }
      },
      error: () => {
        this.isComparisonLoading = false;
        this.loadComparisonVendors();
      }
    });
  }

  loadComparisonVendors(): void {
    this.authService.searchNppForms({ type: 'quotation-comparison', status: 'Submitted' }).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        const first = rows[0] || {};
        const data = first.data || first;
        const qItems = data.quotationItems || [];
        if (qItems.length) {
          this.comparisonItems = qItems.map((row: any) => {
            const qty = Number(row.qty || 1);
            const suppliers = [
              { vendorId: 1, vendorName: data.supplierNames?.[0] || 'Supplier 1', price: Number(row.supplier1Price || 0), amount: Number(row.supplier1Amount || 0) },
              { vendorId: 2, vendorName: data.supplierNames?.[1] || 'Supplier 2', price: Number(row.supplier2Price || 0), amount: Number(row.supplier2Amount || 0) },
              { vendorId: 3, vendorName: data.supplierNames?.[2] || 'Supplier 3', price: Number(row.supplier3Price || 0), amount: Number(row.supplier3Amount || 0) }
            ].filter(s => s.price > 0);
            const lowest = suppliers.length ? suppliers.reduce((a, b) => a.price <= b.price ? a : b) : null;
            return {
              partCode: row.partCode || '',
              description: row.partDescription || '',
              qty,
              suppliers,
              lowestCostVendor: lowest ? { vendorId: lowest.vendorId, vendorName: lowest.vendorName, price: lowest.price } : null,
              selectedVendor: lowest?.vendorName || ''
            };
          });
          this.syncSupplierHeaders();
          if (data.rfqNo || first.rfqNo) this.form.rfqNo = data.rfqNo || first.rfqNo;
        }
      },
      error: () => {}
    });
  }

  private syncSupplierHeaders(): void {
    const names = new Set<string>();
    this.comparisonItems.forEach(item => item.suppliers.forEach(s => names.add(s.vendorName)));
    this.supplierHeaders = names.size ? Array.from(names).slice(0, 3) : ['Supplier 1', 'Supplier 2', 'Supplier 3'];
  }

  getSupplierPrice(item: ComparisonItem, index: number): number {
    return item.suppliers[index]?.price || 0;
  }

  getSupplierAmount(item: ComparisonItem, index: number): number {
    return item.suppliers[index]?.amount || (this.getSupplierPrice(item, index) * item.qty);
  }

  selectVendorManual(item: ComparisonItem, vendorName: string): void {
    this.comparisonMode = 'manual';
    item.selectedVendor = vendorName;
  }

  addCc(): void {
    const emails = this.ccInput.split(/[,;\s\n]+/).map(e => e.trim()).filter(Boolean);
    emails.forEach(e => { if (!this.ccRecipients.includes(e)) this.ccRecipients.push(e); });
    this.ccInput = '';
  }

  addApprover(): void {
    this.approvers.push({ line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', remarks: '', dateTime: '' });
  }

  removeApprover(i: number): void {
    if (this.approvers.length > 1) this.approvers.splice(i, 1);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    Array.from(files).forEach(file => {
      this.attachments.push({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, remark: '' });
    });
  }

  submitForm(): void {
    if (!this.form.requesterName.trim() || !this.form.titleOfActivity.trim()) {
      alert('Requester and title are required');
      return;
    }
    this.isSubmitting = true;
    this.form.status = 'Pending';
    this.onSubmit.emit({
      success: true,
      serialNo: this.prSerialNo,
      type: 'pr-request',
      data: {
        form: { ...this.form, rfqNo: this.form.rfqNo, amount: this.getTotalValue() },
        items: this.items,
        approvers: this.approvers,
        comparisonItems: this.comparisonItems,
        comparisonMode: this.comparisonMode,
        recommendedVendor: this.recommendedVendor,
        attachments: this.attachments,
        ccList: this.ccRecipients
      }
    });
    setTimeout(() => { this.isSubmitting = false; }, 800);
  }

  downloadPdf(): void {
    window.print();
  }

  sendBack(): void {
    this.form.status = 'In Process';
    alert('Request sent back to requester.');
  }

  rejectPr(): void {
    const comments = prompt('Rejection reason:');
    if (!comments) return;
    this.form.status = 'Rejected';
    if (this.prId) {
      this.authService.rejectUnifiedRequest('pr', this.prId, comments).subscribe({ next: () => this.loadStatusSummary() });
    }
  }

  approvePr(): void {
    if (this.prId) {
      this.authService.approveUnifiedRequest('pr', this.prId).subscribe({
        next: () => { this.form.status = 'Approved'; this.loadStatusSummary(); }
      });
    } else {
      this.form.status = 'Approved';
    }
  }
}
