import { Component, EventEmitter, OnInit, Output, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

// ============================================================
//  INTERFACES
// ============================================================

export interface PrLineItem {
  id: number;
  rfqNo: string;
  supplierName: string;
  partCode: string;
  partDescription: string;
  cndt: string;       // Specification / Condition
  uom: string;
  qty: number;
  currency: string;
  unitPrice: number;
  value: number;
}

export interface ComparisonItemRow {
  sNo: number;
  rfqNo: string;
  partCode: string;
  partDescription: string;
  specification: string;
  uom: string;
  qty: number;
  supplier1Price: number;
  supplier1Amount: number;
  supplier2Price: number;
  supplier2Amount: number;
  supplier3Price: number;
  supplier3Amount: number;
}

export interface TermsRow { label: string; s1: string; s2: string; s3: string; }

export interface ApprovalRow {
  line: 'Parallel' | 'Sequential';
  stakeholder: string;
  comments: string;
  designation: string;
  status: 'Approved' | 'Rejected' | 'In-Process' | 'Pending';
  dateTime?: string;
  email?: string;
}

export interface AttachmentRow {
  sNo: number;
  label: string;
  fileName?: string;
  fileSize?: string;
  remark?: string;
}

export interface PrRequestData {
  id?: string;
  prNumber: string;
  serialNo: string;

  // Requester information
  name: string;
  department: string;
  emailId: string;
  requestDate: string;
  contactNo: string;
  organization: string;

  departmentBudget: number;
  balance: number;
  costCenter: string;
  altCostCenter: string;

  titleOfActivity: string;
  approvalFor: string;
  rfqNo: string;

  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  items: PrLineItem[];
  totalValue: number;

  // Quotation comparison block
  comparisonItems: ComparisonItemRow[];
  suppliers: string[];          // [supplier1Name, supplier2Name, supplier3Name]
  termsRows: TermsRow[];
  attachment1: string;
  attachment2: string;
  attachment3: string;
  bestSupplier?: string;
  selectedSupplier?: string;
  recommendation?: string;

  approvalChain: ApprovalRow[];
  attachments: AttachmentRow[];
  ccList: string[];

  submittedDate?: string;
  approvedBy?: string;
  approvalDate?: string;
  comparisonId?: string;
}

@Component({
  selector: 'app-pr-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pr-request.html',
  styleUrls: ['./pr-request.scss'],
  providers: [DatePipe]
})
export class PrRequest implements OnInit, OnDestroy {
  @Output() onSubmit = new EventEmitter<any>();

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
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // ---------------- comparison load state ----------------
  isLoadingComparison = false;

  // ---------------- form fields ----------------
  currentSerialNo = '';
  today: string = new Date().toISOString().split('T')[0];

  ccInput = '';

  uomOptions: string[] = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Pcs', 'Set', 'Unit', 'Hour'];
  termsLabels: string[] = ['GST', 'Transport', 'Payment terms', 'Lead time'];

  newPR: PrRequestData = this.blankPR();

  // ---------------- footer clock ----------------
  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------- auto-load comparison flag ----------------
  private isLoadingFromApi = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe
  ) {}

  // ============================================================
  //  LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user) {
      this.newPR.name = user.name || '';
      this.newPR.department = user.department || 'Purchase';
      this.newPR.contactNo = user.contactNo || '';
      this.newPR.emailId = user.email || '';
      this.newPR.organization = user.organization || 'Radiant Appliances';
    }
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadAll();
    this.generateSerialNo();

    this.refreshInterval = setInterval(() => {
      if (this.showListView) this.loadAll();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentDate = now;
    this.currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private generateSerialNo(): void {
    const date = new Date();
    const dateStr = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000 + 1000);
    this.currentSerialNo = `PR-DRAFT-${dateStr}-${random}`;
    this.newPR.serialNo = this.currentSerialNo;
  }

  // ============================================================
  //  BLANK / DEFAULT DATA BUILDERS
  // ============================================================

  private blankPR(): PrRequestData {
    return {
      id: '',
      prNumber: '',
      serialNo: '',
      name: '',
      department: 'Purchase',
      emailId: '',
      requestDate: this.today,
      contactNo: '',
      organization: 'Radiant Appliances',
      departmentBudget: 1500000,
      balance: 1500000,
      costCenter: 'Purchase Department',
      altCostCenter: '',
      titleOfActivity: 'PR Process for Approval',
      approvalFor: '',
      rfqNo: '',
      status: 'Draft',
      items: [this.blankItem(1)],
      totalValue: 0,
      comparisonItems: [],
      suppliers: ['', '', ''],
      termsRows: this.blankTermsRows(),
      attachment1: '',
      attachment2: '',
      attachment3: '',
      approvalChain: [this.blankApprovalRow()],
      attachments: this.blankAttachments(),
      ccList: []
    };
  }

  private blankItem(id: number): PrLineItem {
    return {
      id, rfqNo: '', supplierName: '', partCode: '', partDescription: '',
      cndt: '', uom: 'Nos', qty: 1, currency: 'INR', unitPrice: 0, value: 0
    };
  }

  private blankTermsRows(): TermsRow[] {
    return [
      { label: 'GST', s1: 'Extra', s2: 'Extra', s3: 'Extra' },
      { label: 'Transport', s1: 'Extra', s2: 'Extra', s3: 'Extra' },
      { label: 'Payment terms', s1: '100% Against Proforma Invoice', s2: '100% Against Proforma Invoice', s3: '100% Against Proforma Invoice' },
      { label: 'Lead time', s1: '', s2: '', s3: '' }
    ];
  }

  private blankApprovalRow(): ApprovalRow {
    return { line: 'Parallel', stakeholder: '', comments: '', designation: '', status: 'Pending' };
  }

  private blankAttachments(): AttachmentRow[] {
    return [
      { sNo: 1, label: 'Attachment 1' },
      { sNo: 2, label: 'Attachment 2' },
      { sNo: 3, label: 'Attachment 3' }
    ];
  }

  // ============================================================
  //  API INTEGRATION - LIST
  // ============================================================

  loadAll(): void {
    this.isLoading = true;
    this.fetchPRsFromAPI();
  }

  fetchPRsFromAPI(): void {
    this.authService.getPrList().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        let apiPRs: any[] = [];
        if (res?.success && res?.data) {
          apiPRs = Array.isArray(res.data) ? res.data : [];
        } else if (Array.isArray(res)) {
          apiPRs = res;
        } else if (res?.items) {
          apiPRs = res.items;
        }

        // Merge with local storage data
        const localPRs = this.loadFromStorage();
        const merged = this.mergePRs(localPRs, apiPRs);
        this.allPRs = merged;
        
        // Also fetch comparisons and auto-create PRs from submitted comparisons
        this.fetchSubmittedComparisons();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.allPRs = this.loadFromStorage();
        this.fetchSubmittedComparisons();
        this.showToastMessage('Using cached data. Please check connection.', 'error');
      }
    });
  }

  private fetchSubmittedComparisons(): void {
    this.authService.getSubmittedComparisons().subscribe({
      next: (res: any) => {
        if (res?.success && res?.data) {
          const comparisons = Array.isArray(res.data) ? res.data : [res.data];
          comparisons.forEach((comp: any) => {
            // Check if PR already exists for this comparison
            const exists = this.allPRs.some(pr => pr.comparisonId === comp.rfqId || pr.rfqNo === comp.rfqNo);
            if (!exists && comp.status === 'Submitted') {
              const newPR = this.createPRFromComparison(comp);
              this.allPRs.unshift(newPR);
              this.saveToStorage(newPR);
            }
          });
          this.cdr.detectChanges();
        }
      },
      error: () => {
        // Try loading from localStorage
        this.loadSubmittedComparisonsFromStorage();
      }
    });
  }

  private loadSubmittedComparisonsFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('quotation_comparison_requests');
      if (!stored) return;
      const comparisons = JSON.parse(stored);
      const submitted = comparisons.filter((c: any) => c.status === 'Submitted');
      submitted.forEach((comp: any) => {
        const exists = this.allPRs.some(pr => pr.comparisonId === comp.rfqId || pr.rfqNo === comp.rfqNo);
        if (!exists) {
          const newPR = this.createPRFromComparison(comp);
          this.allPRs.unshift(newPR);
          this.saveToStorage(newPR);
        }
      });
      this.cdr.detectChanges();
    } catch { /* ignore */ }
  }

  private createPRFromComparison(comp: any): PrRequestData {
    const suppliers = comp.suppliers || [comp.supplier1Name, comp.supplier2Name, comp.supplier3Name].filter(Boolean);
    const items = comp.quotationItems || comp.items || [];
    const bestIdx = this.getBestSupplierIndexFromData(items, suppliers);

    const prData: PrRequestData = {
      id: `PR-${Date.now()}`,
      prNumber: `PR-${Date.now()}`,
      serialNo: `PR-${Date.now()}`,
      name: comp.requester || comp.requesterName || '',
      department: comp.department || 'Purchase',
      emailId: comp.requesterEmail || '',
      requestDate: new Date().toISOString().split('T')[0],
      contactNo: '',
      organization: 'Radiant Appliances',
      departmentBudget: 1500000,
      balance: 1500000,
      costCenter: 'Purchase Department',
      altCostCenter: '',
      titleOfActivity: comp.title || 'PR from Quotation Comparison',
      approvalFor: '',
      rfqNo: comp.rfqNo || '',
      status: 'Pending',
      items: items.map((item: any, idx: number) => ({
        id: idx + 1,
        rfqNo: comp.rfqNo || '',
        supplierName: suppliers[bestIdx] || suppliers[0] || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || item.description || '',
        cndt: item.specification || item.specs || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        currency: 'INR',
        unitPrice: this.getSupplierPriceFromItem(item, bestIdx),
        value: (item.qty || 1) * this.getSupplierPriceFromItem(item, bestIdx)
      })),
      totalValue: items.reduce((sum: number, item: any) => sum + (item.qty || 1) * this.getSupplierPriceFromItem(item, bestIdx), 0),
      comparisonItems: items.map((item: any, idx: number) => ({
        sNo: idx + 1,
        rfqNo: comp.rfqNo || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || item.description || '',
        specification: item.specification || item.specs || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        supplier1Price: item.supplier1Price || 0,
        supplier1Amount: (item.supplier1Price || 0) * (item.qty || 1),
        supplier2Price: item.supplier2Price || 0,
        supplier2Amount: (item.supplier2Price || 0) * (item.qty || 1),
        supplier3Price: item.supplier3Price || 0,
        supplier3Amount: (item.supplier3Price || 0) * (item.qty || 1)
      })),
      suppliers: suppliers,
      termsRows: comp.conditionRows ? comp.conditionRows.map((r: any) => ({ label: r.label, s1: r.s1, s2: r.s2, s3: r.s3 })) : this.blankTermsRows(),
      attachment1: comp.attachments?.supplier1 || '',
      attachment2: comp.attachments?.supplier2 || '',
      attachment3: comp.attachments?.supplier3 || '',
      bestSupplier: comp.bestSupplier || suppliers[bestIdx] || '',
      selectedSupplier: comp.selectedSupplier || suppliers[bestIdx] || '',
      recommendation: comp.recommendation || `Recommended supplier: ${suppliers[bestIdx] || '—'}`,
      approvalChain: comp.approvalChain ? comp.approvalChain.map((a: any) => ({
        line: a.line || 'Parallel',
        stakeholder: a.name || a.stakeholder || '',
        comments: a.remarks || a.comments || '',
        designation: a.designation || '',
        status: a.status || 'Pending',
        dateTime: a.approvalDate || new Date().toISOString(),
        email: a.email || ''
      })) : [this.blankApprovalRow()],
      attachments: this.blankAttachments(),
      ccList: comp.ccList || [],
      submittedDate: new Date().toISOString(),
      comparisonId: comp.rfqId || comp.id || comp.rfqNo
    };

    return prData;
  }

  private getSupplierPriceFromItem(item: any, index: number): number {
    if (index === 0) return item.supplier1Price || 0;
    if (index === 1) return item.supplier2Price || 0;
    return item.supplier3Price || 0;
  }

  private getBestSupplierIndexFromData(items: any[], suppliers: string[]): number {
    if (!items || !items.length) return 0;
    const totals = [0, 0, 0];
    items.forEach((item: any) => {
      totals[0] += (item.supplier1Price || 0) * (item.qty || 1);
      totals[1] += (item.supplier2Price || 0) * (item.qty || 1);
      totals[2] += (item.supplier3Price || 0) * (item.qty || 1);
    });
    let bestIdx = 0;
    let bestVal = Infinity;
    totals.forEach((t, i) => {
      if (t > 0 && t < bestVal) { bestVal = t; bestIdx = i; }
    });
    return bestVal === Infinity ? 0 : bestIdx;
  }

  private mergePRs(local: PrRequestData[], api: any[]): PrRequestData[] {
    const merged: PrRequestData[] = [];
    const localMap = new Map<string, PrRequestData>();
    local.forEach(pr => localMap.set(pr.id || pr.serialNo, pr));

    // Add API PRs first
    api.forEach(apiPr => {
      const id = apiPr.id || apiPr.serialNo;
      if (id && localMap.has(id)) {
        merged.push({ ...localMap.get(id)!, ...apiPr });
        localMap.delete(id);
      } else {
        merged.push(this.hydrate(apiPr));
      }
    });

    // Add remaining local PRs
    localMap.forEach(pr => merged.push(pr));

    return merged.sort((a, b) => (b.submittedDate || b.requestDate || '').localeCompare(a.submittedDate || a.requestDate || ''));
  }

  loadFromStorage(): PrRequestData[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = localStorage.getItem('pr_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveToStorage(pr: PrRequestData): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const all = this.loadFromStorage();
      const idx = all.findIndex((r: any) => r.id === pr.id);
      if (idx >= 0) all[idx] = pr; else all.unshift(pr);
      localStorage.setItem('pr_requests', JSON.stringify(all));
    } catch { /* ignore */ }
  }

  // ============================================================
  //  LIST VIEW HELPERS
  // ============================================================

  get displayRows(): PrRequestData[] {
    let rows = [...this.allPRs];
    if (this.activeFilter !== 'All') rows = rows.filter(r => r.status === this.activeFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      rows = rows.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.serialNo || '').toLowerCase().includes(q) ||
        (r.rfqNo || '').toLowerCase().includes(q) ||
        (r.titleOfActivity || '').toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  }

  countByStatus(s: 'All' | 'Draft' | 'Pending' | 'Approved' | 'Rejected'): number {
    if (s === 'All') return this.allPRs.length;
    return this.allPRs.filter(r => r.status === s).length;
  }

  setFilter(f: 'All' | 'Draft' | 'Pending' | 'Approved' | 'Rejected'): void { this.activeFilter = f; }

  refreshData(): void {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    this.fetchPRsFromAPI();
    setTimeout(() => this.showToastMessage(`${this.allPRs.length} PR(s) found`, 'success'), 500);
  }

  trackByPR(_: number, r: PrRequestData): string | undefined { return r.id; }

  // ============================================================
  //  TOAST
  // ============================================================

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3000);
  }
  closeToast(): void { this.showToast = false; }

  // ============================================================
  //  NAVIGATION
  // ============================================================

  showListViewScreen(): void {
    this.showListView = true;
    this.showFormView = false;
    this.currentPR = null;
    this.submitSuccess = false;
    this.loadAll();
    this.cdr.detectChanges();
  }

  openForm(): void {
    const user = this.authService.getUser();
    this.newPR = this.blankPR();
    this.newPR.name = user?.name || '';
    this.newPR.department = user?.department || 'Purchase';
    this.newPR.contactNo = user?.contactNo || '';
    this.newPR.emailId = user?.email || '';
    this.newPR.organization = user?.organization || 'Radiant Appliances';
    this.generateSerialNo();
    this.showListView = false;
    this.showFormView = true;
    this.currentPR = null;
    this.cdr.detectChanges();
  }

  editPR(pr: PrRequestData): void {
    this.currentPR = this.hydrate(JSON.parse(JSON.stringify(pr)));
    this.showListView = false;
    this.showFormView = true;
    // Load comparison data if RFQ exists
    if (pr.rfqNo || pr.comparisonId) {
      this.loadComparisonData(pr.rfqNo || pr.comparisonId || '');
    }
    this.cdr.detectChanges();
  }

  viewPR(pr: PrRequestData): void {
    this.currentPR = this.hydrate(JSON.parse(JSON.stringify(pr)));
    this.showListView = false;
    this.showFormView = true;
    // Always try to load fresh comparison data
    if (pr.rfqNo || pr.comparisonId) {
      this.loadComparisonData(pr.rfqNo || pr.comparisonId || '');
    }
    this.cdr.detectChanges();
  }

  /** Ensure older / partial records have all required arrays populated */
  private hydrate(pr: any): PrRequestData {
    const hydrated: PrRequestData = {
      id: pr.id || `PR-${Date.now()}`,
      prNumber: pr.prNumber || pr.serialNo || `PR-${Date.now()}`,
      serialNo: pr.serialNo || pr.prNumber || `PR-${Date.now()}`,
      name: pr.name || '',
      department: pr.department || 'Purchase',
      emailId: pr.emailId || '',
      requestDate: pr.requestDate || this.today,
      contactNo: pr.contactNo || '',
      organization: pr.organization || 'Radiant Appliances',
      departmentBudget: pr.departmentBudget || 1500000,
      balance: pr.balance ?? pr.departmentBudget ?? 1500000,
      costCenter: pr.costCenter || 'Purchase Department',
      altCostCenter: pr.altCostCenter || '',
      titleOfActivity: pr.titleOfActivity || 'PR Process for Approval',
      approvalFor: pr.approvalFor || '',
      rfqNo: pr.rfqNo || '',
      status: pr.status || 'Draft',
      items: pr.items?.length ? pr.items : [this.blankItem(1)],
      totalValue: pr.totalValue || 0,
      comparisonItems: pr.comparisonItems || [],
      suppliers: pr.suppliers?.length === 3 ? pr.suppliers : ['', '', ''],
      termsRows: pr.termsRows?.length ? pr.termsRows : this.blankTermsRows(),
      attachment1: pr.attachment1 || '',
      attachment2: pr.attachment2 || '',
      attachment3: pr.attachment3 || '',
      bestSupplier: pr.bestSupplier || '',
      selectedSupplier: pr.selectedSupplier || '',
      recommendation: pr.recommendation || '',
      approvalChain: pr.approvalChain?.length ? pr.approvalChain : [this.blankApprovalRow()],
      attachments: pr.attachments?.length ? pr.attachments : this.blankAttachments(),
      ccList: pr.ccList || [],
      submittedDate: pr.submittedDate || '',
      approvedBy: pr.approvedBy || '',
      approvalDate: pr.approvalDate || '',
      comparisonId: pr.comparisonId || ''
    };
    return hydrated;
  }

  get activePR(): PrRequestData {
    return this.currentPR || this.newPR;
  }

  // ============================================================
  //  QUOTATION COMPARISON INTEGRATION
  // ============================================================

  loadComparisonData(rfqId: string): void {
    if (!rfqId) return;
    if (this.isLoadingFromApi) return;
    this.isLoadingFromApi = true;
    this.isLoadingComparison = true;
    this.showToastMessage('Loading comparison data...', 'info');

    this.authService.getQuotationComparisonByRfq(rfqId).subscribe({
      next: (res: any) => {
        this.isLoadingFromApi = false;
        this.isLoadingComparison = false;
        if (res?.success && res?.data) {
          this.applyComparisonData(res.data);
          this.showToastMessage('Comparison data loaded successfully!', 'success');
          this.cdr.detectChanges();
        } else {
          this.loadComparisonFromStorage(rfqId);
        }
      },
      error: () => {
        this.isLoadingFromApi = false;
        this.isLoadingComparison = false;
        this.loadComparisonFromStorage(rfqId);
      }
    });
  }

  private loadComparisonFromStorage(rfqId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('quotation_comparison_requests');
      if (!stored) return;
      const comparisons = JSON.parse(stored);
      const comparison = comparisons.find((c: any) => c.rfqNo === rfqId || c.rfqId === rfqId || c.rfqNo === rfqId);
      if (comparison) {
        this.applyComparisonData(comparison);
        this.showToastMessage('Comparison data loaded from cache', 'info');
        this.cdr.detectChanges();
      } else {
        this.showToastMessage('No comparison data found for this RFQ', 'info');
      }
    } catch { 
      this.showToastMessage('No comparison data found', 'info');
    }
  }

  /** Maps quotation-comparison API/local payload onto the active PR's comparison + item fields */
  private applyComparisonData(compData: any): void {
    const pr = this.activePR;
    const suppliers: string[] = compData.suppliers || [compData.supplier1Name, compData.supplier2Name, compData.supplier3Name].filter(Boolean);

    pr.suppliers = [suppliers[0] || '', suppliers[1] || '', suppliers[2] || ''];

    if (compData.title) pr.titleOfActivity = compData.title;
    if (compData.requester) pr.name = pr.name || compData.requester;
    if (compData.department) pr.department = pr.department || compData.department;
    if (compData.requesterEmail) pr.emailId = pr.emailId || compData.requesterEmail;
    if (compData.rfqNo) pr.rfqNo = compData.rfqNo;

    const items = compData.quotationItems || compData.items || [];
    pr.comparisonItems = items.map((item: any, idx: number): ComparisonItemRow => ({
      sNo: idx + 1,
      rfqNo: compData.rfqNo || pr.rfqNo || '',
      partCode: item.partCode || '',
      partDescription: item.partDescription || item.description || '',
      specification: item.specification || item.specs || '',
      uom: item.uom || 'Nos',
      qty: Number(item.qty || 1),
      supplier1Price: Number(item.supplier1Price || 0),
      supplier1Amount: Number(item.supplier1Amount ?? (item.supplier1Price || 0) * (item.qty || 1)),
      supplier2Price: Number(item.supplier2Price || 0),
      supplier2Amount: Number(item.supplier2Amount ?? (item.supplier2Price || 0) * (item.qty || 1)),
      supplier3Price: Number(item.supplier3Price || 0),
      supplier3Amount: Number(item.supplier3Amount ?? (item.supplier3Price || 0) * (item.qty || 1))
    }));

    if (Array.isArray(compData.conditionRows) && compData.conditionRows.length) {
      pr.termsRows = compData.conditionRows.map((r: any) => ({ label: r.label, s1: r.s1, s2: r.s2, s3: r.s3 }));
    }

    pr.attachment1 = compData.attachments?.supplier1 || compData.attachment1 || pr.attachment1;
    pr.attachment2 = compData.attachments?.supplier2 || compData.attachment2 || pr.attachment2;
    pr.attachment3 = compData.attachments?.supplier3 || compData.attachment3 || pr.attachment3;

    pr.bestSupplier = compData.bestSupplier || this.getBestSupplier();
    pr.selectedSupplier = compData.selectedSupplier || pr.bestSupplier;
    pr.recommendation = compData.recommendation ||
      `It is recommended to place the order on M/s. ${pr.bestSupplier || 'the lowest priced vendor'} based on lowest total cost.`;

    // Auto-populate the PR request grid from the recommended supplier's prices
    if (pr.comparisonItems.length) {
      const bestIdx = this.getBestSupplierIndex();
      pr.items = pr.comparisonItems.map((ci, idx) => ({
        id: idx + 1,
        rfqNo: ci.rfqNo,
        supplierName: pr.suppliers[bestIdx] || pr.bestSupplier || '',
        partCode: ci.partCode,
        partDescription: ci.partDescription,
        cndt: ci.specification,
        uom: ci.uom,
        qty: ci.qty,
        currency: 'INR',
        unitPrice: this.getSupplierPriceByIndex(ci, bestIdx),
        value: this.getSupplierAmountByIndex(ci, bestIdx)
      }));
      this.calculateTotal();
      this.cdr.detectChanges();
    }
  }

  // ====================== COMPARISON TABLE HELPERS ======================

  getSupplierPrice(item: ComparisonItemRow, index: number): number {
    if (index === 0) return item.supplier1Price || 0;
    if (index === 1) return item.supplier2Price || 0;
    return item.supplier3Price || 0;
  }
  private getSupplierPriceByIndex(item: ComparisonItemRow, index: number): number { return this.getSupplierPrice(item, index); }

  getSupplierAmount(item: ComparisonItemRow, index: number): number {
    if (index === 0) return item.supplier1Amount || 0;
    if (index === 1) return item.supplier2Amount || 0;
    return item.supplier3Amount || 0;
  }
  private getSupplierAmountByIndex(item: ComparisonItemRow, index: number): number { return this.getSupplierAmount(item, index); }

  isLowestPrice(item: ComparisonItemRow, index: number): boolean {
    const prices = [item.supplier1Price || 0, item.supplier2Price || 0, item.supplier3Price || 0].filter(p => p > 0);
    if (!prices.length) return false;
    const min = Math.min(...prices);
    const current = this.getSupplierPrice(item, index);
    return current > 0 && current === min;
  }

  getSupplierTotal(index: number): number {
    const pr = this.activePR;
    return (pr.comparisonItems || []).reduce((sum, item) => sum + this.getSupplierAmount(item, index), 0);
  }

  getSupplierTotalPercent(index: number): number {
    const totals = [this.getSupplierTotal(0), this.getSupplierTotal(1), this.getSupplierTotal(2)];
    const valid = totals.filter(t => t > 0);
    if (!valid.length) return 0;
    const min = Math.min(...valid);
    const t = totals[index];
    if (!t || min <= 0) return 0;
    return Math.round(((t - min) / min) * 100);
  }

  isBestSupplierTotal(index: number): boolean {
    const totals = [this.getSupplierTotal(0), this.getSupplierTotal(1), this.getSupplierTotal(2)];
    const valid = totals.filter(t => t > 0);
    if (!valid.length) return false;
    const min = Math.min(...valid);
    return totals[index] > 0 && totals[index] === min;
  }

  getBestSupplierIndex(): number {
    const totals = [this.getSupplierTotal(0), this.getSupplierTotal(1), this.getSupplierTotal(2)];
    let bestIdx = 0; let bestVal = Infinity;
    totals.forEach((t, i) => { if (t > 0 && t < bestVal) { bestVal = t; bestIdx = i; } });
    return bestVal === Infinity ? 0 : bestIdx;
  }

  getBestSupplier(): string {
    const pr = this.activePR;
    const idx = this.getBestSupplierIndex();
    return pr.suppliers?.[idx] || '';
  }

  hasComparisonData(): boolean {
    const pr = this.activePR;
    return !!pr.comparisonItems?.length;
  }

  reloadComparison(): void {
    const pr = this.activePR;
    if (!pr.rfqNo) {
      this.showToastMessage('Enter an RFQ No. first', 'info');
      return;
    }
    this.loadComparisonData(pr.rfqNo);
  }

  // ====================== TERMS ROWS ======================

  addTermsRow(): void {
    this.activePR.termsRows.push({ label: 'Other', s1: '', s2: '', s3: '' });
    this.cdr.detectChanges();
  }
  removeTermsRow(i: number): void {
    if (this.activePR.termsRows.length <= 1) return;
    this.activePR.termsRows.splice(i, 1);
    this.cdr.detectChanges();
  }

  // ============================================================
  //  PR ITEM GRID
  // ============================================================

  addItem(): void {
    const target = this.activePR;
    const newId = Math.max(...target.items.map(i => i.id), 0) + 1;
    target.items.push(this.blankItem(newId));
    this.cdr.detectChanges();
  }

  removeItem(index: number): void {
    const target = this.activePR;
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
    const target = this.activePR;
    target.totalValue = target.items.reduce((sum, item) => sum + (item.value || 0), 0);
    target.balance = (target.departmentBudget || 0) - target.totalValue;
  }

  // ============================================================
  //  APPROVAL CHAIN
  // ============================================================

  addApprovalRow(line: 'Parallel' | 'Sequential' = 'Sequential'): void {
    this.activePR.approvalChain.push({ line, stakeholder: '', comments: '', designation: '', status: 'Pending' });
    this.cdr.detectChanges();
  }

  removeApprovalRow(index: number): void {
    const pr = this.activePR;
    if (pr.approvalChain.length <= 1) {
      this.showToastMessage('At least one approver is required', 'info');
      return;
    }
    pr.approvalChain.splice(index, 1);
    this.cdr.detectChanges();
  }

  getApprovalStatusClass(status: string): string {
    const map: any = { Approved: 'approved', Rejected: 'rejected', 'In-Process': 'in-process', Pending: 'pending' };
    return map[status] || 'pending';
  }

  // ============================================================
  //  ATTACHMENTS
  // ============================================================

  onAttachmentFileSelected(row: AttachmentRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    row.fileName = file.name;
    row.fileSize = this.formatFileSize(file.size);
    this.cdr.detectChanges();
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ============================================================
  //  CC LIST
  // ============================================================

  addCc(): void {
    const raw = this.ccInput.trim();
    if (!raw) return;
    raw.split(/[;,\s\n]+/).map(x => x.trim().replace(/[<>]/g, '')).filter(Boolean).forEach(email => {
      if (email.includes('@') && !this.activePR.ccList.includes(email)) this.activePR.ccList.push(email);
    });
    this.ccInput = '';
    this.cdr.detectChanges();
  }

  removeCc(index: number): void {
    this.activePR.ccList.splice(index, 1);
    this.cdr.detectChanges();
  }

  // ============================================================
  //  SAVE / SUBMIT
  // ============================================================

  saveDraft(): void {
    const pr = this.activePR;
    if (!pr.name || !pr.department) {
      this.showToastMessage('Please fill in Requester Name and Department', 'error');
      return;
    }

    pr.status = 'Draft';
    pr.id = pr.id || `PR-${Date.now()}`;
    pr.serialNo = pr.serialNo || this.currentSerialNo;
    pr.prNumber = pr.serialNo;
    this.calculateTotal();

    this.authService.savePR(pr).subscribe({
      next: () => this.onSaveSuccess(pr, 'Draft saved successfully!'),
      error: () => this.onSaveSuccess(pr, 'Draft saved locally!')
    });
  }

  submitForApproval(): void {
    const pr = this.activePR;

    if (!pr.name || !pr.department) {
      this.showToastMessage('Please fill in Requester Name and Department', 'error');
      return;
    }
    const hasItems = pr.items.some(item => item.partDescription || item.supplierName);
    if (!hasItems) {
      this.showToastMessage('Please add at least one item with description', 'error');
      return;
    }
    const validApprovers = pr.approvalChain.filter(a => a.stakeholder && a.stakeholder.trim());
    if (!validApprovers.length) {
      this.showToastMessage('Please add at least one approver', 'error');
      return;
    }

    this.isSubmitting = true;
    this.showToastMessage('Submitting PR for approval...', 'info');

    pr.status = 'Pending';
    pr.id = pr.id || `PR-${Date.now()}`;
    pr.serialNo = pr.serialNo || this.currentSerialNo;
    pr.prNumber = pr.serialNo;
    pr.submittedDate = new Date().toISOString();
    this.calculateTotal();

    this.authService.submitPR(pr).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.saveToStorage(pr);
        this.showToastMessage('PR submitted for approval successfully!', 'success');
        this.onSubmit.emit({ success: true, type: 'PR Request', serialNo: pr.serialNo, data: pr });
        setTimeout(() => { this.submitSuccess = false; this.showListViewScreen(); }, 1500);
      },
      error: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.saveToStorage(pr);
        this.showToastMessage('PR saved locally! Will sync when online.', 'info');
        setTimeout(() => { this.submitSuccess = false; this.showListViewScreen(); }, 1500);
      }
    });
  }

  private onSaveSuccess(pr: PrRequestData, message: string): void {
    this.saveToStorage(pr);
    this.submitSuccess = true;
    this.showToastMessage(message, 'success');
    setTimeout(() => { this.submitSuccess = false; this.showListViewScreen(); }, 1500);
  }

  // ============================================================
  //  UTILITY / DISPLAY HELPERS
  // ============================================================

  getStatusClass(status: string): string {
    const map: any = { Draft: 'draft', Pending: 'pending', Approved: 'approved', Rejected: 'rejected' };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: any = { Draft: 'Draft', Pending: 'Pending Approval', Approved: 'Approved ✓', Rejected: 'Rejected ✗' };
    return map[status] || status;
  }

  getStatusIcon(status: string): string {
    const map: any = { Draft: '📝', Pending: '⏳', Approved: '✅', Rejected: '❌' };
    return map[status] || '📋';
  }

  formatCurrency(value: number): string {
    return (value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}