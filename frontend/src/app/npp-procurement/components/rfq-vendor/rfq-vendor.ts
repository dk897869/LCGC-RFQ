import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

// ====================================================================
//  Types
// ====================================================================

export interface RFQLineItemView {
  description: string;
  uom: string;
  qty: number;
  make?: string;
  altSimilar?: string;
  remark?: string;
}

export interface ApprovedRFQ {
  id: string;
  uniqueSerialNo: string;
  title: string;
  requester: string;
  email?: string;
  department: string;
  priority: string;
  status: string;
  requestDate?: string;
  organization?: string;
  contactNo?: string;
  description?: string;
  objective?: string;
  items: RFQLineItemView[];
  approvedBy?: string;
  approvalDate?: string;
}

export type VendorStatus = 'Pending' | 'Approved' | 'Rejected';

export interface VendorEntry {
  serialNo: number;
  vendorName: string;
  email: string;
  company?: string;
  phone?: string;
  status: VendorStatus;
  remarks?: string;
  respondedDate?: string;
}

export type VendorStage = 'NotSent' | 'Sent' | 'Completed';

export interface VendorRequestRecord {
  id: string;
  rfqId: string;
  rfqNo: string;
  rfq: ApprovedRFQ;
  vendors: VendorEntry[];
  stage: VendorStage;
  sentDate?: string;
  completedDate?: string;
}

/** Shared storage key — also read by the Quotation Comparison module. */
export const VENDOR_STORAGE_KEY = 'npp_vendor_requests';

@Component({
  selector: 'app-rfq-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rfq-vendor.html',
  styleUrls: ['./rfq-vendor.scss']
})
export class RfqVendorComponent implements OnInit, OnDestroy {

  // ---------------- data ----------------
  approvedRFQs: ApprovedRFQ[] = [];
  vendorRequests: VendorRequestRecord[] = [];
  isLoading = false;

  // ---------------- search / filter ----------------
  searchTerm = '';
  activeFilter: 'All' | 'NotSent' | 'InProgress' = 'All';

  // ---------------- toast ----------------
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------- modals ----------------
  showDetailModal = false;
  showSendVendorModal = false;
  showStatusModal = false;

  selectedRFQ: ApprovedRFQ | null = null;
  selectedVendorRequest: VendorRequestRecord | null = null;

  vendorBoxes: VendorEntry[] = [];
  vendorSearchResultsByIndex: Record<number, any[]> = {};
  isSubmittingVendors = false;

  statusVendors: VendorEntry[] = [];
  isSavingStatus = false;

  // ---------------- footer clock ----------------
  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadVendorRequestsFromStorage();
    this.loadApprovedRFQs();
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

  loadApprovedRFQs() {
    this.isLoading = true;
    this.authService.getApprovedRFQs().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const data = res?.data || res?.items || (Array.isArray(res) ? res : []);
        this.approvedRFQs = Array.isArray(data) ? data.map((r: any) => this.mapApprovedRfq(r)) : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.approvedRFQs = [];
        this.cdr.detectChanges();
      }
    });
  }

  private mapApprovedRfq(r: any): ApprovedRFQ {
    const items: RFQLineItemView[] = (r.items || []).map((it: any) => ({
      description: it.itemDescription || it.description || '',
      uom: it.uom || 'Pcs',
      qty: Number(it.quantity ?? it.qty ?? 1),
      make: it.make || '',
      altSimilar: it.alternativeSimilar || it.altSimilar || '',
      remark: it.remark || ''
    }));
    return {
      id: String(r._id || r.id || r.uniqueSerialNo || r.rfqNo || Date.now()),
      uniqueSerialNo: r.uniqueSerialNo || r.rfqNo || r.serialNo || '—',
      title: r.titleOfActivity || r.title || '—',
      requester: r.requesterName || r.requester || '—',
      email: r.emailId || r.email || '',
      department: r.department || '—',
      priority: r.priority || 'M',
      status: r.status || 'Approved',
      requestDate: r.requestDate || r.date || r.createdAt || '',
      organization: r.organization || '',
      contactNo: r.contactNo || '',
      description: r.purposeAndObjective || r.description || '',
      objective: r.objective || '',
      items,
      approvedBy: r.approvedBy || '',
      approvalDate: r.approvalDate || ''
    };
  }

  loadVendorRequestsFromStorage() {
    if (typeof localStorage === 'undefined') { this.vendorRequests = []; return; }
    try {
      const saved = localStorage.getItem(VENDOR_STORAGE_KEY);
      this.vendorRequests = saved ? JSON.parse(saved) : [];
    } catch {
      this.vendorRequests = [];
    }
  }

  private saveVendorRequestsToStorage() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(this.vendorRequests));
  }

  refreshData() {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    this.loadVendorRequestsFromStorage();
    setTimeout(() => {
      this.loadApprovedRFQs();
      this.showToastMessage(`${this.displayRows.length} RFQ(s) found`, 'success');
    }, 500);
  }

  checkStatusSummary() {
    this.showToastMessage(`${this.displayRows.length} RFQ request(s) awaiting vendor action`, 'info');
  }

  // ====================== DERIVED LIST ======================

  getVendorRequestFor(rfqId: string): VendorRequestRecord | undefined {
    return this.vendorRequests.find(v => v.rfqId === rfqId);
  }

  get displayRows(): { rfq: ApprovedRFQ; vr: VendorRequestRecord | undefined }[] {
    let rows = this.approvedRFQs
      .map(rfq => ({ rfq, vr: this.getVendorRequestFor(rfq.id) }))
      .filter(row => !row.vr || row.vr.stage !== 'Completed');

    if (this.activeFilter === 'NotSent') {
      rows = rows.filter(r => !r.vr || r.vr.stage === 'NotSent');
    } else if (this.activeFilter === 'InProgress') {
      rows = rows.filter(r => !!r.vr && r.vr.stage === 'Sent');
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.rfq.title.toLowerCase().includes(q) ||
        r.rfq.requester.toLowerCase().includes(q) ||
        r.rfq.department.toLowerCase().includes(q) ||
        r.rfq.uniqueSerialNo.toLowerCase().includes(q)
      );
    }
    return rows;
  }

  countByStage(stage: 'All' | 'NotSent' | 'InProgress'): number {
    const base = this.approvedRFQs
      .map(rfq => ({ rfq, vr: this.getVendorRequestFor(rfq.id) }))
      .filter(row => !row.vr || row.vr.stage !== 'Completed');
    if (stage === 'All') return base.length;
    if (stage === 'NotSent') return base.filter(r => !r.vr || r.vr.stage === 'NotSent').length;
    return base.filter(r => !!r.vr && r.vr.stage === 'Sent').length;
  }

  setFilter(f: 'All' | 'NotSent' | 'InProgress') { this.activeFilter = f; }

  get totalRfqsCount(): number {
    return this.approvedRFQs.length;
  }

  get pendingRfqsCount(): number {
    return this.approvedRFQs.filter(r => {
      const vr = this.getVendorRequestFor(r.id);
      return !vr || vr.stage !== 'Completed';
    }).length;
  }

  get approvedRfqsCount(): number {
    return this.approvedRFQs.filter(r => {
      const vr = this.getVendorRequestFor(r.id);
      return vr && vr.stage === 'Completed';
    }).length;
  }

  get successRate(): number {
    const total = this.totalRfqsCount;
    if (total === 0) return 0;
    return Math.round((this.approvedRfqsCount / total) * 100);
  }

  getVendorStageLabel(vr: VendorRequestRecord | null | undefined): string {
    if (!vr || vr.stage === 'NotSent' || !vr.vendors.length) return 'Not Sent';
    const approved = vr.vendors.filter(v => v.status === 'Approved').length;
    return `${approved}/${vr.vendors.length} Approved`;
  }

  getVendorStageClass(vr: VendorRequestRecord | null | undefined): string {
    if (!vr || vr.stage === 'NotSent' || !vr.vendors.length) return 'not-sent';
    const approved = vr.vendors.filter(v => v.status === 'Approved').length;
    const rejected = vr.vendors.filter(v => v.status === 'Rejected').length;
    if (approved === vr.vendors.length) return 'completed';
    if (rejected > 0) return 'attention';
    return 'in-progress';
  }

  // ====================== TOAST ======================

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3000);
  }
  closeToast() { this.showToast = false; }

  // ====================== DETAIL MODAL ======================

  openDetail(rfq: ApprovedRFQ) {
    this.selectedRFQ = rfq;
    this.selectedVendorRequest = this.getVendorRequestFor(rfq.id) || null;
    this.showDetailModal = true;
  }
  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedRFQ = null;
    this.selectedVendorRequest = null;
  }

  // ====================== SEND TO VENDOR MODAL ======================

  openSendVendorModal(rfq: ApprovedRFQ) {
    this.selectedRFQ = rfq;
    this.selectedVendorRequest = this.getVendorRequestFor(rfq.id) || null;
    const existing = this.selectedVendorRequest;
    if (existing && existing.vendors.length) {
      this.vendorBoxes = existing.vendors.map(v => ({ ...v }));
    } else {
      this.vendorBoxes = [this.blankVendor(1)];
    }
    this.vendorSearchResultsByIndex = {};
    this.showSendVendorModal = true;
    this.showDetailModal = false;
  }

  private blankVendor(serialNo: number): VendorEntry {
    return { serialNo, vendorName: '', email: '', company: '', phone: '', status: 'Pending', remarks: '' };
  }

  addVendorBox() {
    if (this.vendorBoxes.length < 4) {
      this.vendorBoxes.push(this.blankVendor(this.vendorBoxes.length + 1));
    }
  }

  removeVendorBox(i: number) {
    if (this.vendorBoxes.length <= 1) return;
    this.vendorBoxes.splice(i, 1);
    this.vendorBoxes.forEach((v, idx) => v.serialNo = idx + 1);
  }

  searchVendorByEmail(index: number, term: string) {
    if (!term || term.length < 3) {
      this.vendorSearchResultsByIndex[index] = [];
      return;
    }
    this.authService.searchVendors(term).subscribe({
      next: (res: any) => {
        const data = res?.data || res?.items || [];
        this.vendorSearchResultsByIndex[index] = Array.isArray(data) ? data : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.vendorSearchResultsByIndex[index] = [];
        this.cdr.detectChanges();
      }
    });
  }

  selectVendorSuggestion(index: number, result: any) {
    const box = this.vendorBoxes[index];
    if (!box) return;
    box.vendorName = result.name || result.vendorName || box.vendorName;
    box.email = result.email || box.email;
    box.company = result.company || result.organization || box.company;
    box.phone = result.phone || result.contactNo || box.phone;
    this.vendorSearchResultsByIndex[index] = [];
  }

  closeSendVendorModal() {
    this.showSendVendorModal = false;
    this.vendorBoxes = [];
    this.vendorSearchResultsByIndex = {};
  }

  sendToVendors() {
    if (!this.selectedRFQ) return;
    if (!this.vendorBoxes.length) {
      this.showToastMessage('Please add at least one vendor', 'error');
      return;
    }
    for (const v of this.vendorBoxes) {
      if (!v.vendorName?.trim() || !v.email?.trim()) {
        this.showToastMessage('Vendor name and email are required for all vendors', 'error');
        return;
      }
    }
    const emails = this.vendorBoxes.map(v => v.email.toLowerCase().trim());
    if (new Set(emails).size !== emails.length) {
      this.showToastMessage('Duplicate vendor emails are not allowed', 'error');
      return;
    }

    this.isSubmittingVendors = true;
    const rfqId = this.selectedRFQ.id;
    const rfqSnapshot = this.selectedRFQ;
    let record = this.getVendorRequestFor(rfqId);

    const vendors: VendorEntry[] = this.vendorBoxes.map((v, i) => ({
      ...v,
      serialNo: i + 1,
      status: v.status || 'Pending'
    }));

    if (record) {
      record.vendors = vendors;
      record.stage = 'Sent';
      record.sentDate = record.sentDate || new Date().toISOString();
    } else {
      record = {
        id: rfqId,
        rfqId,
        rfqNo: rfqSnapshot.uniqueSerialNo,
        rfq: rfqSnapshot,
        vendors,
        stage: 'Sent',
        sentDate: new Date().toISOString()
      };
      this.vendorRequests.unshift(record);
    }
    this.saveVendorRequestsToStorage();

    const payload = {
      rfqId,
      rfqNumber: rfqSnapshot.uniqueSerialNo,
      vendors: vendors.map(v => ({
        vendorName: v.vendorName, email: v.email, company: v.company || '', phone: v.phone || '', status: 'Pending'
      })),
      createdBy: this.authService.getUser()?.id,
      createdDate: new Date().toISOString(),
      status: 'Sent'
    };
    this.authService.createVendorRequest(payload).subscribe({ next: () => {}, error: () => {} });

    setTimeout(() => {
      this.isSubmittingVendors = false;
      this.showToastMessage('RFQ sent to vendors successfully!', 'success');
      this.closeSendVendorModal();
      this.cdr.detectChanges();
    }, 600);
  }

  // ====================== STATUS MODAL ======================

  openStatusModal(rfq: ApprovedRFQ) {
    this.selectedRFQ = rfq;
    const record = this.getVendorRequestFor(rfq.id);
    if (!record || !record.vendors.length) {
      this.showToastMessage('No vendors have been sent for this RFQ yet', 'info');
      return;
    }
    this.selectedVendorRequest = record;
    this.statusVendors = record.vendors.map(v => ({ ...v }));
    this.showStatusModal = true;
    this.showDetailModal = false;
  }

  closeStatusModal() {
    this.showStatusModal = false;
    this.statusVendors = [];
    this.selectedVendorRequest = null;
  }

  saveVendorStatuses() {
    if (!this.selectedVendorRequest) return;
    this.isSavingStatus = true;

    const record = this.vendorRequests.find(v => v.id === this.selectedVendorRequest!.id);
    if (record) {
      record.vendors = this.statusVendors.map(v => ({
        ...v,
        respondedDate: v.status !== 'Pending' ? (v.respondedDate || new Date().toISOString()) : v.respondedDate
      }));
      const allApproved = record.vendors.length > 0 && record.vendors.every(v => v.status === 'Approved');
      if (allApproved && record.stage !== 'Completed') {
        record.stage = 'Completed';
        record.completedDate = new Date().toISOString();
        this.showToastMessage('🎉 All vendors approved! RFQ moved to Quotation Comparison.', 'success');
      } else {
        this.showToastMessage('Vendor status updated.', 'success');
      }
      this.saveVendorRequestsToStorage();
    }

    setTimeout(() => {
      this.isSavingStatus = false;
      this.closeStatusModal();
      this.cdr.detectChanges();
    }, 400);
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
  getStatusBadgeClass(status: VendorStatus): string {
    if (status === 'Approved') return 'approved';
    if (status === 'Rejected') return 'rejected';
    return 'pending';
  }
  trackByRfq(_: number, row: { rfq: ApprovedRFQ }) { return row.rfq.id; }
}