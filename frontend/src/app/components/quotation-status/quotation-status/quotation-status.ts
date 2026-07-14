import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

// ====================================================================
//  Types
// ====================================================================

export interface VendorStatus {
  serialNo: number;
  vendorName: string;
  email: string;
  company?: string;
  phone?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Quoted';
  remarks?: string;
  quotationSubmitted: boolean;
  quotationId?: string;
  submittedDate?: string;
  viewedDate?: string;
}

export interface VendorRequestRecord {
  id: string;
  rfqId: string;
  rfqNo: string;
  title: string;
  requester: string;
  email?: string;
  department: string;
  priority: string;
  vendors: VendorStatus[];
  stage: 'NotSent' | 'Sent' | 'Received' | 'Completed';
  sentDate?: string;
  completedDate?: string;
  createdDate?: string;
  rfq?: any;
}

export interface QuotationReceived {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  price: number;
  gst: number;
  discount: number;
  deliveryDays: number;
  warranty: string;
  paymentTerms: string;
  remarks: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Winner';
  submittedDate: string;
}

const VENDOR_STORAGE_KEY = 'npp_vendor_requests';
const QUOTATION_STORAGE_KEY = 'npp_quotations';

@Component({
  selector: 'app-quotation-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation-status.html',
  styleUrls: ['./quotation-status.scss']
})
export class QuotationStatusComponent implements OnInit, OnDestroy {

  // ---------------- view state ----------------
  isLoading = false;
  searchTerm = '';
  activeFilter: 'All' | 'NotSent' | 'Sent' | 'Received' | 'Completed' = 'All';

  // ---------------- data ----------------
  vendorRequests: VendorRequestRecord[] = [];
  quotations: QuotationReceived[] = [];

  // ---------------- selected for detail modal ----------------
  selectedRequest: VendorRequestRecord | null = null;
  showDetailModal = false;

  // ---------------- toast ----------------
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------- footer clock ----------------
  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  openCreate() {
    window.dispatchEvent(new CustomEvent('npp-navigate-tab', { detail: 'rfq-npp-form' }));
  }

  private updateClock() {
    this.currentDate = new Date();
    this.currentTime = this.currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  // ====================== LOAD DATA ======================

  loadData() {
    this.isLoading = true;
    this.loadVendorRequests();
    this.loadQuotations();
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 500);
  }

  private loadVendorRequests() {
    if (typeof localStorage === 'undefined') { this.vendorRequests = []; return; }
    try {
      const saved = localStorage.getItem(VENDOR_STORAGE_KEY);
      this.vendorRequests = saved ? JSON.parse(saved) : [];
    } catch {
      this.vendorRequests = [];
    }
  }

  private loadQuotations() {
    if (typeof localStorage === 'undefined') { this.quotations = []; return; }
    try {
      const saved = localStorage.getItem(QUOTATION_STORAGE_KEY);
      this.quotations = saved ? JSON.parse(saved) : [];
    } catch {
      this.quotations = [];
    }
  }

  refreshData() {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    setTimeout(() => {
      this.loadData();
      this.showToastMessage(`${this.displayRows.length} RFQ(s) found`, 'success');
    }, 500);
  }

  // ====================== DERIVED DATA ======================

  get displayRows(): VendorRequestRecord[] {
    let rows = [...this.vendorRequests];

    if (this.activeFilter !== 'All') {
      if (this.activeFilter === 'NotSent') {
        rows = rows.filter(r => r.stage === 'NotSent');
      } else if (this.activeFilter === 'Sent') {
        rows = rows.filter(r => r.stage === 'Sent');
      } else if (this.activeFilter === 'Received') {
        rows = rows.filter(r => r.stage === 'Received');
      } else if (this.activeFilter === 'Completed') {
        rows = rows.filter(r => r.stage === 'Completed');
      }
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      rows = rows.filter(r =>
        (r.rfqNo || '').toLowerCase().includes(q) ||
        (r.title || r.rfq?.title || '').toLowerCase().includes(q) ||
        (r.requester || r.rfq?.requester || '').toLowerCase().includes(q) ||
        (r.department || r.rfq?.department || '').toLowerCase().includes(q)
      );
    }

    return rows.sort((a, b) => {
      return new Date(b.sentDate || b.createdDate || 0).getTime() - 
             new Date(a.sentDate || a.createdDate || 0).getTime();
    });
  }

  countByStatus(status: 'All' | 'NotSent' | 'Sent' | 'Received' | 'Completed'): number {
    if (status === 'All') return this.vendorRequests.length;
    return this.vendorRequests.filter(r => r.stage === status).length;
  }

  setFilter(f: 'All' | 'NotSent' | 'Sent' | 'Received' | 'Completed') {
    this.activeFilter = f;
  }

  get totalRfqsCount(): number {
    return this.vendorRequests.length;
  }

  get pendingRfqsCount(): number {
    return this.vendorRequests.filter(r => r.stage !== 'Completed').length;
  }

  get approvedRfqsCount(): number {
    return this.vendorRequests.filter(r => r.stage === 'Completed').length;
  }

  get successRate(): number {
    const total = this.totalRfqsCount;
    if (total === 0) return 0;
    return Math.round((this.approvedRfqsCount / total) * 100);
  }

  // ====================== VENDOR STATUS HELPERS ======================

  getVendorCount(vendors: VendorStatus[]): number {
    return vendors?.length || 0;
  }

  getApprovedCount(vendors: VendorStatus[]): number {
    return vendors?.filter(v => v.status === 'Approved').length || 0;
  }

  getRejectedCount(vendors: VendorStatus[]): number {
    return vendors?.filter(v => v.status === 'Rejected').length || 0;
  }

  getPendingCount(vendors: VendorStatus[]): number {
    return vendors?.filter(v => v.status === 'Pending').length || 0;
  }

  getQuotedCount(vendors: VendorStatus[]): number {
    return vendors?.filter(v => v.quotationSubmitted === true).length || 0;
  }

  getVendorStageLabel(request: VendorRequestRecord): string {
    if (!request || request.stage === 'NotSent' || !request.vendors?.length) return 'Not Sent';
    const approved = this.getApprovedCount(request.vendors);
    const total = request.vendors.length;
    if (approved === total) return 'Completed';
    const quoted = this.getQuotedCount(request.vendors);
    if (quoted > 0) return `${quoted}/${total} Quoted`;
    return 'Sent';
  }

  getVendorStageClass(request: VendorRequestRecord): string {
    if (!request || request.stage === 'NotSent' || !request.vendors?.length) return 'not-sent';
    const approved = this.getApprovedCount(request.vendors);
    const total = request.vendors.length;
    if (approved === total) return 'completed';
    const rejected = this.getRejectedCount(request.vendors);
    if (rejected > 0) return 'attention';
    const quoted = this.getQuotedCount(request.vendors);
    if (quoted > 0) return 'in-progress';
    return 'sent';
  }

  getVendorStatusClass(status: string): string {
    const map: any = {
      'Pending': 'pending',
      'Approved': 'approved',
      'Rejected': 'rejected',
      'Quoted': 'quoted'
    };
    return map[status] || 'pending';
  }

  getStatusLabel(status: string): string {
    const map: any = {
      'Pending': '⏳ Pending',
      'Approved': '✅ Approved',
      'Rejected': '❌ Rejected',
      'Quoted': '📄 Quoted',
      'NotSent': '📤 Not Sent',
      'Sent': '📨 Sent',
      'Received': '📥 Received',
      'Completed': '✅ Completed'
    };
    return map[status] || status;
  }

  // ====================== QUOTATION HELPERS ======================

  getQuotationsForRfq(rfqId: string): QuotationReceived[] {
    return this.quotations.filter(q => q.rfqId === rfqId);
  }

  getTotalQuotationValue(quotations: QuotationReceived[]): number {
    return quotations.reduce((sum, q) => sum + q.price, 0);
  }

  getBestQuotation(quotations: QuotationReceived[]): QuotationReceived | null {
    if (!quotations.length) return null;
    return quotations.reduce((min, q) => q.price < min.price ? q : min, quotations[0]);
  }

  // ====================== DETAIL MODAL ======================

  openDetail(request: VendorRequestRecord) {
    this.selectedRequest = request;
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedRequest = null;
  }

  // ====================== TOAST ======================

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3000);
  }

  closeToast() {
    this.showToast = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ====================== UTIL ======================

  getPriorityLabel(p: string): string {
    const map: any = { H: 'High', M: 'Medium', L: 'Low' };
    return map[p] || p;
  }

  getPriorityClass(p: string): string {
    const map: any = { H: 'high', M: 'medium', L: 'low' };
    return map[p] || '';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: '2-digit' 
    });
  }

  formatDateTime(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatAmount(amount?: number): string {
    return amount ? '₹' + amount.toLocaleString('en-IN') : '₹0';
  }

  trackByRequest(_: number, item: VendorRequestRecord) {
    return item.id;
  }
}