import { Component, Output, EventEmitter, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

export interface PrLineItem {
  id: number;
  rfqNo: string;
  supplierName: string;
  partCode: string;
  partDescription: string;
  cndt: string;
  uom: string;
  qty: number;
  currency: string;
  unitPrice: number;
  value: number;
}

export interface PrRequestData {
  id?: string;
  prNumber: string;
  serialNo: string;
  name: string;
  requestDate: string;
  department: string;
  contactNo: string;
  emailId: string;
  organization: string;
  departmentBudget: number;
  costCenter: string;
  rfqNo: string;
  titleOfActivity: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  items: PrLineItem[];
  totalValue: number;
  submittedDate?: string;
  approvedBy?: string;
  approvalDate?: string;
}

@Component({
  selector: 'app-pr-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pr-npp.html',
  styleUrls: ['./pr-npp.scss'],
  providers: [DatePipe]
})
export class PrRequest implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();
  @Input() rfqData: any = null;

  // ---------------- view state ----------------
  showListView = true;
  showFormView = false;
  isLoading = false;

  // ---------------- list search / filter ----------------
  searchTerm = '';
  activeFilter: 'All' | 'Draft' | 'Pending' | 'Approved' | 'Rejected' = 'All';

  // ---------------- toast ----------------
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------- data ----------------
  allPRs: PrRequestData[] = [];
  currentPR: PrRequestData | null = null;
  isSubmitting = false;
  submitSuccess = false;

  // ---------------- form fields ----------------
  currentSerialNo = '';
  today: string = new Date().toISOString().split('T')[0];

  newPR: PrRequestData = {
    id: '',
    prNumber: '',
    serialNo: '',
    name: '',
    requestDate: this.today,
    department: 'Purchase',
    contactNo: '',
    emailId: '',
    organization: 'Radiant Appliances',
    departmentBudget: 1500000,
    costCenter: 'Purchase Department',
    rfqNo: '',
    titleOfActivity: '',
    status: 'Draft',
    items: [{
      id: 1,
      rfqNo: '',
      supplierName: '',
      partCode: '',
      partDescription: '',
      cndt: '',
      uom: 'Nos',
      qty: 1,
      currency: 'INR',
      unitPrice: 0,
      value: 0
    }],
    totalValue: 0
  };

  // ---------------- footer clock ----------------
  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------- constants ----------------
  readonly STORAGE_KEY = 'pr_requests';
  uomOptions: string[] = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Pcs', 'Set', 'Unit', 'Hour'];

  constructor(
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    if (user) {
      this.newPR.name = user.name || '';
      this.newPR.department = user.department || 'Purchase';
      this.newPR.contactNo = user.contactNo || '';
      this.newPR.emailId = user.email || '';
    }
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadAll();
    this.generateSerialNo();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentDate = now;
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private generateSerialNo(): void {
    const date = new Date();
    const dateStr = date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000 + 1000);
    this.currentSerialNo = `PR-DRAFT-${dateStr}-${random}`;
    this.newPR.serialNo = this.currentSerialNo;
  }

  // ====================== STORAGE ======================

  loadAll(): void {
    this.isLoading = true;
    this.loadFromStorage();
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 250);
  }

  loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.allPRs = [];
      return;
    }
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      this.allPRs = saved ? JSON.parse(saved) : [];
      console.log('✅ Loaded PRs from storage:', this.allPRs.length);
    } catch (error) {
      console.error('❌ Error loading PRs:', error);
      this.allPRs = [];
    }
  }

  saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.allPRs));
      console.log('✅ Saved PRs to storage:', this.allPRs.length);
    } catch (error) {
      console.error('❌ Error saving PRs:', error);
    }
  }

  // ====================== LIST VIEW ======================

  get displayRows(): PrRequestData[] {
    let rows = [...this.allPRs];
    if (this.activeFilter !== 'All') {
      rows = rows.filter(r => r.status === this.activeFilter);
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.serialNo.toLowerCase().includes(q) ||
        r.rfqNo.toLowerCase().includes(q) ||
        r.titleOfActivity.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }

  countByStatus(s: 'All' | 'Draft' | 'Pending' | 'Approved' | 'Rejected'): number {
    if (s === 'All') return this.allPRs.length;
    return this.allPRs.filter(r => r.status === s).length;
  }

  setFilter(f: 'All' | 'Draft' | 'Pending' | 'Approved' | 'Rejected'): void {
    this.activeFilter = f;
  }

  refreshData(): void {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    setTimeout(() => {
      this.loadAll();
      this.showToastMessage(`${this.allPRs.length} PR(s) found`, 'success');
    }, 500);
  }

  trackByPR(_: number, r: PrRequestData): string | undefined {
    return r.id;
  }

  // ====================== TOAST ======================

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3000);
  }

  closeToast(): void { this.showToast = false; }

  // ====================== NAVIGATION ======================

  showListViewScreen(): void {
    this.showListView = true;
    this.showFormView = false;
    this.currentPR = null;
    this.submitSuccess = false;
    this.loadFromStorage();
    this.cdr.detectChanges();
    console.log('🔄 Navigated to list view. Total PRs:', this.allPRs.length);
  }

  openForm(): void {
    this.newPR = {
      id: '',
      prNumber: '',
      serialNo: '',
      name: this.auth.getUser()?.name || '',
      requestDate: this.today,
      department: this.auth.getUser()?.department || 'Purchase',
      contactNo: this.auth.getUser()?.contactNo || '',
      emailId: this.auth.getUser()?.email || '',
      organization: 'Radiant Appliances',
      departmentBudget: 1500000,
      costCenter: 'Purchase Department',
      rfqNo: '',
      titleOfActivity: '',
      status: 'Draft',
      items: [{
        id: 1,
        rfqNo: '',
        supplierName: '',
        partCode: '',
        partDescription: '',
        cndt: '',
        uom: 'Nos',
        qty: 1,
        currency: 'INR',
        unitPrice: 0,
        value: 0
      }],
      totalValue: 0
    };
    this.generateSerialNo();
    this.showListView = false;
    this.showFormView = true;
    this.currentPR = null;
    this.cdr.detectChanges();
  }

  editPR(pr: PrRequestData): void {
    this.currentPR = JSON.parse(JSON.stringify(pr));
    this.showListView = false;
    this.showFormView = true;
    this.cdr.detectChanges();
  }

  viewPR(pr: PrRequestData): void {
    this.currentPR = JSON.parse(JSON.stringify(pr));
    this.showListView = false;
    this.showFormView = true;
    this.cdr.detectChanges();
  }

  // ====================== FORM ACTIONS ======================

  addItem(): void {
    const target = this.currentPR || this.newPR;
    const newId = Math.max(...target.items.map(i => i.id), 0) + 1;
    target.items.push({
      id: newId,
      rfqNo: '',
      supplierName: '',
      partCode: '',
      partDescription: '',
      cndt: '',
      uom: 'Nos',
      qty: 1,
      currency: 'INR',
      unitPrice: 0,
      value: 0
    });
    this.cdr.detectChanges();
  }

  removeItem(index: number): void {
    const target = this.currentPR || this.newPR;
    if (target.items.length <= 1) {
      this.showToastMessage('At least one item is required', 'info');
      return;
    }
    target.items.splice(index, 1);
    this.calculateTotal();
    this.cdr.detectChanges();
  }

  calculateItemValue(item: PrLineItem): void {
    item.value = (item.qty || 0) * (item.unitPrice || 0);
    this.calculateTotal();
  }

  calculateTotal(): void {
    const target = this.currentPR || this.newPR;
    target.totalValue = target.items.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  // ====================== SAVE / SUBMIT ======================

  saveDraft(): void {
    const pr = this.currentPR || this.newPR;
    
    if (!pr.name || !pr.department) {
      this.showToastMessage('Please fill in Requester Name and Department', 'error');
      return;
    }

    pr.status = 'Draft';
    pr.id = pr.id || `PR-${Date.now()}`;
    pr.serialNo = pr.serialNo || this.currentSerialNo;
    pr.prNumber = pr.serialNo;

    const idx = this.allPRs.findIndex(r => r.id === pr.id);
    const snapshot = JSON.parse(JSON.stringify(pr));
    
    if (idx >= 0) {
      this.allPRs[idx] = snapshot;
    } else {
      this.allPRs.unshift(snapshot);
    }

    this.saveToStorage();
    this.submitSuccess = true;
    this.showToastMessage('Draft saved successfully!', 'success');
    
    setTimeout(() => {
      this.submitSuccess = false;
      this.showListViewScreen();
    }, 1500);
  }

  submitForApproval(): void {
    const pr = this.currentPR || this.newPR;
    
    if (!pr.name || !pr.department) {
      this.showToastMessage('Please fill in Requester Name and Department', 'error');
      return;
    }

    const hasItems = pr.items.some(item => item.partDescription || item.supplierName);
    if (!hasItems) {
      this.showToastMessage('Please add at least one item with description', 'error');
      return;
    }

    this.isSubmitting = true;
    this.showToastMessage('Submitting PR for approval...', 'info');

    setTimeout(() => {
      pr.status = 'Pending';
      pr.id = pr.id || `PR-${Date.now()}`;
      pr.serialNo = pr.serialNo || this.currentSerialNo;
      pr.prNumber = pr.serialNo;
      pr.submittedDate = new Date().toISOString();

      const idx = this.allPRs.findIndex(r => r.id === pr.id);
      const snapshot = JSON.parse(JSON.stringify(pr));
      
      if (idx >= 0) {
        this.allPRs[idx] = snapshot;
      } else {
        this.allPRs.unshift(snapshot);
      }

      this.saveToStorage();
      this.isSubmitting = false;
      this.submitSuccess = true;
      this.showToastMessage('PR submitted for approval successfully!', 'success');
      
      this.onSubmit.emit({
        success: true,
        type: 'PR Request',
        serialNo: pr.serialNo,
        data: pr
      });
      
      setTimeout(() => {
        this.submitSuccess = false;
        this.showListViewScreen();
      }, 1500);
    }, 1000);
  }

  // ====================== UTILITY ======================

  getStatusClass(status: string): string {
    const map: any = {
      'Draft': 'draft',
      'Pending': 'pending',
      'Approved': 'approved',
      'Rejected': 'rejected'
    };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: any = {
      'Draft': 'Draft',
      'Pending': 'Pending Approval',
      'Approved': 'Approved ✓',
      'Rejected': 'Rejected ✗'
    };
    return map[status] || status;
  }

  getStatusIcon(status: string): string {
    const map: any = {
      'Draft': '📝',
      'Pending': '⏳',
      'Approved': '✅',
      'Rejected': '❌'
    };
    return map[status] || '📋';
  }

  formatCurrency(value: number): string {
    return '₹ ' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getPriorityLabel(p: string): string {
    const map: any = { 'high': 'High', 'medium': 'Medium', 'low': 'Low' };
    return map[p] || p;
  }

  getPriorityClass(p: string): string {
    const map: any = { 'high': 'high', 'medium': 'medium', 'low': 'low' };
    return map[p] || '';
  }
}