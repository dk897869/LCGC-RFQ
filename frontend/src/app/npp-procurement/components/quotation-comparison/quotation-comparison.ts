import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

type VendorStatus = 'Pending' | 'Approved' | 'Rejected';

interface VendorEntry {
  serialNo: number;
  vendorName: string;
  email: string;
  company?: string;
  phone?: string;
  status: VendorStatus;
  remarks?: string;
  respondedDate?: string;
}

interface RFQLineItemView {
  description: string;
  uom: string;
  qty: number;
  make?: string;
  altSimilar?: string;
  remark?: string;
}

interface ApprovedRFQSnapshot {
  id: string;
  uniqueSerialNo: string;
  title: string;
  requester: string;
  email?: string;
  department: string;
  priority: string;
  items: RFQLineItemView[];
}

interface VendorRequestRecord {
  id: string;
  rfqId: string;
  rfqNo: string;
  rfq: ApprovedRFQSnapshot;
  vendors: VendorEntry[];
  stage: 'NotSent' | 'Sent' | 'Completed';
  sentDate?: string;
  completedDate?: string;
}

const VENDOR_STORAGE_KEY = 'npp_vendor_requests';
const COMPARISON_STORAGE_KEY = 'quotation_comparison_requests';

interface QuotationItem {
  sNo: number;
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

interface QuotationTerms {
  gst: string;
  transport: string;
  leadTime: string;
  paymentTerms: string;
}

interface ConditionRow { label: string; s1: string; s2: string; s3: string; }

interface QuotationRequest {
  id: string;
  rfqId: string;
  rfqNo: string;
  title: string;
  requester: string;
  requesterEmail?: string;
  department: string;
  priority: string;
  status: 'Pending' | 'Submitted';
  date: string;
  suppliers: string[];
  totalAmount: number;
  bestSupplier: string;
  supplier1Name: string;
  supplier2Name: string;
  supplier3Name: string;
  quotationItems: QuotationItem[];
  terms1: QuotationTerms;
  terms2: QuotationTerms;
  terms3: QuotationTerms;
  conditionRows: ConditionRow[];
  recommendation: string;
  selectedSupplierIndex: 1 | 2 | 3;
  attachment1: string;
  attachment2: string;
  attachment3: string;
}

@Component({
  selector: 'app-quotation-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quotation-comparison.html',
  styleUrls: ['./quotation-comparison.scss']
})
export class QuotationComparisonComponent implements OnInit, OnDestroy {

  // ---------------- view state ----------------
  showListView = true;
  showFormView = false;
  isLoading = false;

  // ---------------- list search / filter ----------------
  searchTerm = '';
  activeFilter: 'All' | 'Pending' | 'Submitted' = 'All';

  // ---------------- toast ----------------
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------------- data ----------------
  allRequests: QuotationRequest[] = [];
  vendorRequests: VendorRequestRecord[] = [];

  // ---------------- active comparison form ----------------
  current: QuotationRequest | null = null;
  comparisonMode: 'auto' | 'manual' = 'auto';
  isLoadingComparison = false;
  isSubmitting = false;
  submitSuccess = false;

  conditionOptions = ['GST', 'Transport', 'Payment Terms', 'Lead Time', 'Warranty', 'Delivery Location', 'Other'];

  // ---------------- footer clock ----------------
  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------- vendor search ----------------
  vendorSearchResults: any[] = [];
  showVendorSuggestions = false;
  isSearchingVendor = false;
  activeVendorSlot: 1 | 2 | 3 = 1;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private updateClock() {
    this.currentDate = new Date();
    this.currentTime = this.currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  // ====================== STORAGE ======================

  loadAll() {
    this.isLoading = true;
    this.loadVendorRequests();
    this.loadRequestsFromStorage();
    this.syncFromVendorRequests();
    // Also fetch from API
    this.fetchComparisonsFromAPI();
    setTimeout(() => { this.isLoading = false; this.cdr.detectChanges(); }, 250);
  }

  private fetchComparisonsFromAPI() {
    this.authService.getComparisons().subscribe({
      next: (res: any) => {
        console.log('✅ Comparisons from API:', res);
        if (res?.success && res?.data) {
          const apiComparisons = Array.isArray(res.data) ? res.data : [res.data];
          // Merge with local data
          apiComparisons.forEach((comp: any) => {
            const exists = this.allRequests.find(r => r.rfqId === comp.rfqId || r.rfqNo === comp.rfqNo);
            if (!exists) {
              this.allRequests.push(this.mapApiToLocal(comp));
            } else {
              // Update existing
              Object.assign(exists, this.mapApiToLocal(comp));
            }
          });
          this.saveRequestsToStorage();
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error fetching comparisons:', error);
        // Use localStorage as fallback
        this.loadRequestsFromStorage();
      }
    });
  }

  private mapApiToLocal(apiData: any): QuotationRequest {
    const suppliers = apiData.suppliers || ['Supplier 1', 'Supplier 2', 'Supplier 3'];
    const items = apiData.quotationItems || apiData.items || [];
    
    return {
      id: apiData.id || apiData.rfqId || `comp-${Date.now()}`,
      rfqId: apiData.rfqId || apiData.id,
      rfqNo: apiData.rfqNo || '',
      title: apiData.title || 'Quotation Comparison',
      requester: apiData.requester || apiData.requesterName || '',
      requesterEmail: apiData.requesterEmail || '',
      department: apiData.department || 'Purchase',
      priority: apiData.priority || 'M',
      status: apiData.status === 'Submitted' ? 'Submitted' : 'Pending',
      date: apiData.date || new Date().toISOString(),
      suppliers: suppliers,
      totalAmount: apiData.totalAmount || 0,
      bestSupplier: apiData.bestSupplier || '',
      supplier1Name: suppliers[0] || '',
      supplier2Name: suppliers[1] || '',
      supplier3Name: suppliers[2] || '',
      quotationItems: items.map((item: any, idx: number) => ({
        sNo: idx + 1,
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
      terms1: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      terms2: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      terms3: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      conditionRows: [
        { label: 'GST', s1: 'Extra', s2: 'Extra', s3: 'Extra' },
        { label: 'Transport', s1: '', s2: '', s3: '' },
        { label: 'Payment Terms', s1: '100% Against Proforma Invoice', s2: '100% Against Proforma Invoice', s3: '100% Against Proforma Invoice' },
        { label: 'Lead Time', s1: '', s2: '', s3: '' }
      ],
      recommendation: apiData.recommendation || '',
      selectedSupplierIndex: 1,
      attachment1: '', attachment2: '', attachment3: ''
    };
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

  loadRequestsFromStorage() {
    if (typeof localStorage === 'undefined') { this.allRequests = []; return; }
    try {
      const saved = localStorage.getItem(COMPARISON_STORAGE_KEY);
      this.allRequests = saved ? JSON.parse(saved) : [];
    } catch {
      this.allRequests = [];
    }
  }

  saveRequestsToStorage() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(this.allRequests));
  }

  private syncFromVendorRequests() {
    const completed = this.vendorRequests.filter(v => v.stage === 'Completed');
    let changed = false;
    completed.forEach(vr => {
      const existing = this.allRequests.find(r => r.rfqId === vr.rfqId);
      if (!existing) {
        this.allRequests.unshift(this.buildQuotationRequest(vr));
        changed = true;
      }
    });
    if (changed) this.saveRequestsToStorage();
  }

  private buildQuotationRequest(vr: VendorRequestRecord): QuotationRequest {
    const approved = vr.vendors.filter(v => v.status === 'Approved').slice(0, 3);
    const supplierNames = [approved[0]?.vendorName || '', approved[1]?.vendorName || '', approved[2]?.vendorName || ''];
    const sourceItems = vr.rfq.items?.length ? vr.rfq.items : [{ description: '', uom: 'Nos', qty: 1 } as RFQLineItemView];
    const items: QuotationItem[] = sourceItems.map((it, i) => ({
      sNo: i + 1,
      partCode: '',
      partDescription: it.description || '',
      specification: it.altSimilar || '',
      uom: it.uom || 'Nos',
      qty: Number(it.qty || 1),
      supplier1Price: 0, supplier1Amount: 0,
      supplier2Price: 0, supplier2Amount: 0,
      supplier3Price: 0, supplier3Amount: 0
    }));
    return {
      id: vr.rfqId,
      rfqId: vr.rfqId,
      rfqNo: vr.rfqNo,
      title: vr.rfq.title,
      requester: vr.rfq.requester,
      requesterEmail: vr.rfq.email || '',
      department: vr.rfq.department,
      priority: vr.rfq.priority || 'M',
      status: 'Pending',
      date: vr.completedDate || new Date().toISOString(),
      suppliers: supplierNames.filter(s => !!s),
      totalAmount: 0,
      bestSupplier: '—',
      supplier1Name: supplierNames[0],
      supplier2Name: supplierNames[1],
      supplier3Name: supplierNames[2],
      quotationItems: items,
      terms1: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      terms2: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      terms3: { gst: 'Extra', transport: '', leadTime: '', paymentTerms: '100% Against Proforma Invoice' },
      conditionRows: [
        { label: 'GST', s1: 'Extra', s2: 'Extra', s3: 'Extra' },
        { label: 'Transport', s1: '', s2: '', s3: '' },
        { label: 'Payment Terms', s1: '100% Against Proforma Invoice', s2: '100% Against Proforma Invoice', s3: '100% Against Proforma Invoice' },
        { label: 'Lead Time', s1: '', s2: '', s3: '' }
      ],
      recommendation: '',
      selectedSupplierIndex: 1,
      attachment1: '', attachment2: '', attachment3: ''
    };
  }

  // ====================== LIST VIEW ======================

  get displayRows(): QuotationRequest[] {
    let rows = [...this.allRequests];
    if (this.activeFilter !== 'All') rows = rows.filter(r => r.status === this.activeFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.title.toLowerCase().includes(q) || r.requester.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) || r.rfqNo.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  countByStatus(s: 'All' | 'Pending' | 'Submitted'): number {
    if (s === 'All') return this.allRequests.length;
    return this.allRequests.filter(r => r.status === s).length;
  }
  setFilter(f: 'All' | 'Pending' | 'Submitted') { this.activeFilter = f; }

  refreshData() {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    setTimeout(() => {
      this.loadAll();
      this.fetchComparisonsFromAPI();
      this.showToastMessage(`${this.allRequests.length} quotation comparison(s) found`, 'success');
    }, 500);
  }

  checkStatus() {
    this.showToastMessage(`Total ${this.allRequests.length} quotation comparison(s) found`, 'info');
  }

  trackByRequest(_: number, r: QuotationRequest) { return r.id; }

  // ====================== TOAST ======================

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimer = setTimeout(() => { this.showToast = false; }, 3000);
  }
  closeToast() { this.showToast = false; }

  // ====================== NAVIGATION ======================

  showListViewScreen() {
    this.showListView = true;
    this.showFormView = false;
    this.current = null;
    this.loadRequestsFromStorage();
    this.fetchComparisonsFromAPI();
  }

  openCompareForm(request: QuotationRequest) {
    this.current = JSON.parse(JSON.stringify(request));
    this.comparisonMode = 'auto';
    this.showListView = false;
    this.showFormView = true;
    this.recalcCurrent();
    this.fetchBackendSuggestion();
  }

  // ====================== VENDOR SEARCH ======================

  searchVendorForSlot(slot: 1 | 2 | 3, term: string) {
    this.activeVendorSlot = slot;
    if (!term || term.length < 3) {
      this.vendorSearchResults = [];
      this.showVendorSuggestions = false;
      return;
    }

    this.isSearchingVendor = true;
    this.authService.searchVendors(term).subscribe({
      next: (res: any) => {
        this.isSearchingVendor = false;
        const data = res?.data || res?.items || [];
        this.vendorSearchResults = Array.isArray(data) ? data : [];
        this.showVendorSuggestions = this.vendorSearchResults.length > 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSearchingVendor = false;
        this.vendorSearchResults = [];
        this.showVendorSuggestions = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectVendorSuggestion(result: any) {
    if (!this.current) return;

    if (this.activeVendorSlot === 1) {
      this.current.supplier1Name = result.name || result.vendorName;
    } else if (this.activeVendorSlot === 2) {
      this.current.supplier2Name = result.name || result.vendorName;
    } else if (this.activeVendorSlot === 3) {
      this.current.supplier3Name = result.name || result.vendorName;
    }

    this.vendorSearchResults = [];
    this.showVendorSuggestions = false;
    this.recalcCurrent();
    this.cdr.detectChanges();
  }

  // ====================== AUTO / MANUAL ======================

  loadAutoComparison() {
    if (!this.current) return;
    this.comparisonMode = 'auto';
    this.isLoadingComparison = true;
    this.showToastMessage('Reloading approved vendor data...', 'info');

    const vr = this.vendorRequests.find(v => v.rfqId === this.current!.rfqId);
    if (vr) {
      const fresh = this.buildQuotationRequest(vr);
      fresh.quotationItems = fresh.quotationItems.map((item, i) => {
        const prev = this.current!.quotationItems[i];
        return prev ? {
          ...item,
          supplier1Price: prev.supplier1Price,
          supplier2Price: prev.supplier2Price,
          supplier3Price: prev.supplier3Price
        } : item;
      });
      fresh.attachment1 = this.current!.attachment1;
      fresh.attachment2 = this.current!.attachment2;
      fresh.attachment3 = this.current!.attachment3;
      fresh.status = this.current!.status;
      this.current = fresh;
      this.current.quotationItems.forEach(it => this.calcAmounts(it));
    }
    this.isLoadingComparison = false;
    this.fetchBackendSuggestion();
    this.showToastMessage('Vendor data refreshed.', 'success');
  }

  switchToManual() {
    this.comparisonMode = 'manual';
    this.showToastMessage('Switched to manual mode — auto-refresh paused', 'info');
  }

  private fetchBackendSuggestion() {
    if (!this.current) return;
    this.authService.getPrComparison(this.current.rfqId).subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        const vendorName = data?.recommendedVendor?.vendorName || data?.bestSupplier;
        if (vendorName && this.current) {
          this.current.recommendation = `Backend suggestion: place the order on M/s. ${vendorName}.`;
          this.cdr.detectChanges();
        }
      },
      error: () => { /* no backend suggestion available — client-side comparison still applies */ }
    });
  }

  // ====================== ITEMS ======================

  addRow() {
    if (!this.current) return;
    const newItem: QuotationItem = {
      sNo: this.current.quotationItems.length + 1,
      partCode: '',
      partDescription: '',
      specification: '',
      uom: '',
      qty: 1,
      supplier1Price: 0,
      supplier1Amount: 0,
      supplier2Price: 0,
      supplier2Amount: 0,
      supplier3Price: 0,
      supplier3Amount: 0
    };
    this.current.quotationItems.push(newItem);
    this.current.quotationItems.forEach((item, i) => item.sNo = i + 1);
    this.recalcCurrent();
    this.cdr.detectChanges();
  }

  removeRow(index: number) {
    if (!this.current || this.current.quotationItems.length <= 1) {
      this.showToastMessage('At least one item is required', 'info');
      return;
    }
    this.current.quotationItems.splice(index, 1);
    this.current.quotationItems.forEach((item, i) => item.sNo = i + 1);
    this.recalcCurrent();
    this.cdr.detectChanges();
  }

  calcAmounts(item: QuotationItem) {
    item.supplier1Amount = Number(item.qty || 0) * Number(item.supplier1Price || 0);
    item.supplier2Amount = Number(item.qty || 0) * Number(item.supplier2Price || 0);
    item.supplier3Amount = Number(item.qty || 0) * Number(item.supplier3Price || 0);
    this.recalcCurrent();
    this.cdr.detectChanges();
  }

  // ====================== CALCULATIONS ======================

  getTotals(): { t1: number; t2: number; t3: number } {
    if (!this.current) return { t1: 0, t2: 0, t3: 0 };
    const t1 = this.current.quotationItems.reduce((s, i) => s + (i.supplier1Amount || 0), 0);
    const t2 = this.current.quotationItems.reduce((s, i) => s + (i.supplier2Amount || 0), 0);
    const t3 = this.current.quotationItems.reduce((s, i) => s + (i.supplier3Amount || 0), 0);
    return { t1, t2, t3 };
  }

  getBestSupplier(): string {
    if (!this.current) return '—';
    const { t1, t2, t3 } = this.getTotals();
    const entries = [
      { name: this.current.supplier1Name, total: t1 },
      { name: this.current.supplier2Name, total: t2 },
      { name: this.current.supplier3Name, total: t3 }
    ].filter(e => e.name && e.name.trim() && e.total > 0);
    if (!entries.length) return '—';
    const min = Math.min(...entries.map(e => e.total));
    return entries.find(e => e.total === min)?.name || '—';
  }

  getSelectedSupplier(): string {
    if (!this.current) return '—';
    if (this.current.selectedSupplierIndex === 1) return this.current.supplier1Name || '—';
    if (this.current.selectedSupplierIndex === 2) return this.current.supplier2Name || '—';
    return this.current.supplier3Name || '—';
  }

  selectSupplier(index: 1 | 2 | 3) {
    if (!this.current) return;
    this.comparisonMode = 'manual';
    this.current.selectedSupplierIndex = index;
    this.recalcCurrent();
    this.cdr.detectChanges();
  }

  getSelectedVsBestMessage(): string {
    const best = this.getBestSupplier();
    const selected = this.getSelectedSupplier();
    if (selected === best) return `${selected} is currently the lowest total cost vendor.`;
    if (best === '—') return 'No vendor quotes available yet.';
    return `${best} provides the same requirement at a lower total price. Please review before final approval.`;
  }

  isBestSupplier(i: 1 | 2 | 3): boolean {
    const { t1, t2, t3 } = this.getTotals();
    const allTotals = [t1, t2, t3];
    const validTotals = allTotals.filter(t => t > 0);
    if (validTotals.length === 0) return false;
    const min = Math.min(...validTotals);
    if (i === 1) return t1 === min && t1 > 0;
    if (i === 2) return t2 === min && t2 > 0;
    return t3 === min && t3 > 0;
  }

  isLowestItemPrice(item: QuotationItem, i: 1 | 2 | 3): boolean {
    const prices = [
      item.supplier1Price || 0,
      item.supplier2Price || 0,
      item.supplier3Price || 0
    ].filter(v => Number(v) > 0);
    if (!prices.length) return false;
    const min = Math.min(...prices);
    if (i === 1) return (item.supplier1Price || 0) === min;
    if (i === 2) return (item.supplier2Price || 0) === min;
    return (item.supplier3Price || 0) === min;
  }

  getSavings(): string {
    const { t1, t2, t3 } = this.getTotals();
    const all = [t1, t2, t3].filter(v => v > 0);
    if (all.length < 2) return '0';
    return (Math.max(...all) - Math.min(...all)).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  recalcCurrent() {
    if (!this.current) return;
    const best = this.getBestSupplier();
    if (best === '—') {
      this.current.recommendation = this.current.recommendation || 'Enter vendor prices to generate a recommendation.';
      return;
    }
    const selected = this.getSelectedSupplier();
    this.current.recommendation = selected === best
      ? `It is recommended to place the order on M/s. ${best} based on lowest total cost.`
      : `Selected vendor is M/s. ${selected}, however M/s. ${best} provides the same requirement at a lower price.`;
  }

  addConditionRow() {
    if (!this.current) return;
    this.current.conditionRows.push({ label: 'Other', s1: '', s2: '', s3: '' });
    this.cdr.detectChanges();
  }

  // ====================== ATTACHMENTS ======================

  onAttachmentSelected(slot: 1 | 2 | 3, event: Event) {
    if (!this.current) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (slot === 1) this.current.attachment1 = file.name;
    if (slot === 2) this.current.attachment2 = file.name;
    if (slot === 3) this.current.attachment3 = file.name;
    this.cdr.detectChanges();
  }

  // ====================== SAVE / SUBMIT ======================

  saveDraft() {
    if (!this.current) return;
    this.current.status = 'Pending';
    this.persistCurrent();
    this.submitSuccess = true;
    this.showToastMessage('Draft saved successfully!', 'success');
    setTimeout(() => { this.submitSuccess = false; }, 2500);
  }

  submitQuotation() {
    if (!this.current) return;
    
    const hasAnyAmount = this.current.quotationItems.some(
      it => (it.supplier1Amount || 0) > 0 || (it.supplier2Amount || 0) > 0 || (it.supplier3Amount || 0) > 0
    );
    
    if (!hasAnyAmount) {
      this.showToastMessage('Please enter at least one vendor price before submitting', 'error');
      return;
    }

    this.isSubmitting = true;
    this.showToastMessage('Submitting quotation comparison...', 'info');

    // ✅ Prepare data for API
    const submissionData = {
      rfqId: this.current.rfqId,
      rfqNo: this.current.rfqNo,
      title: this.current.title,
      requester: this.current.requester,
      requesterEmail: this.current.requesterEmail,
      department: this.current.department,
      priority: this.current.priority,
      status: 'Submitted',
      date: new Date().toISOString(),
      suppliers: [this.current.supplier1Name, this.current.supplier2Name, this.current.supplier3Name].filter(Boolean),
      bestSupplier: this.getBestSupplier(),
      totalAmount: this.getTotals().t1 + this.getTotals().t2 + this.getTotals().t3,
      quotationItems: this.current.quotationItems.map(item => ({
        partCode: item.partCode,
        partDescription: item.partDescription,
        specification: item.specification,
        uom: item.uom,
        qty: item.qty,
        supplier1Price: item.supplier1Price,
        supplier1Amount: item.supplier1Amount,
        supplier2Price: item.supplier2Price,
        supplier2Amount: item.supplier2Amount,
        supplier3Price: item.supplier3Price,
        supplier3Amount: item.supplier3Amount
      })),
      recommendation: this.current.recommendation,
      selectedSupplier: this.getSelectedSupplier(),
      conditionRows: this.current.conditionRows,
      attachments: {
        supplier1: this.current.attachment1,
        supplier2: this.current.attachment2,
        supplier3: this.current.attachment3
      }
    };

    // ✅ CALL API - Submit comparison
    this.authService.submitQuotationComparison(submissionData).subscribe({
      next: (response: any) => {
        console.log('✅ Quotation comparison submitted to API:', response);
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.current!.status = 'Submitted';
        
        // ✅ Save locally
        this.persistCurrent();
        
        // ✅ Fetch updated list
        this.fetchComparisonsFromAPI();
        
        this.showToastMessage('Quotation comparison submitted successfully!', 'success');
        
        // ✅ Auto-create PR in PR Process
        this.createPRFromComparison(submissionData);
        
        setTimeout(() => {
          this.submitSuccess = false;
          this.showListViewScreen();
        }, 1500);
      },
      error: (error) => {
        console.error('❌ Error submitting to API:', error);
        // ✅ Fallback - Save locally
        this.isSubmitting = false;
        this.current!.status = 'Submitted';
        this.persistCurrent();
        this.showToastMessage('Saved locally. Will sync when online.', 'info');
        
        // ✅ Auto-create PR locally
        this.createPRFromComparison(submissionData);
        
        setTimeout(() => {
          this.showListViewScreen();
        }, 1500);
      }
    });
  }

  // ✅ NEW: Auto-create PR from comparison
  private createPRFromComparison(comparisonData: any) {
    const prData = {
      rfqNo: comparisonData.rfqNo,
      title: comparisonData.title,
      name: comparisonData.requester,
      department: comparisonData.department,
      emailId: comparisonData.requesterEmail || '',
      requestDate: new Date().toISOString().split('T')[0],
      organization: 'Radiant Appliances',
      departmentBudget: 1500000,
      costCenter: 'Purchase Department',
      titleOfActivity: comparisonData.title || 'PR from Quotation Comparison',
      status: 'Pending',
      items: comparisonData.quotationItems.map((item: any, index: number) => ({
        id: index + 1,
        rfqNo: comparisonData.rfqNo,
        supplierName: comparisonData.bestSupplier || comparisonData.suppliers[0] || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || '',
        cndt: item.specification || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        currency: 'INR',
        unitPrice: item.supplier1Price || 0,
        value: (item.qty || 1) * (item.supplier1Price || 0)
      })),
      totalValue: comparisonData.quotationItems.reduce((sum: number, item: any) => 
        sum + (item.qty || 1) * (item.supplier1Price || 0), 0),
      submittedDate: new Date().toISOString(),
      comparisonId: comparisonData.rfqId || `comp-${Date.now()}`
    };

    // ✅ Call API to create PR
    this.authService.createPRFromComparison(prData).subscribe({
      next: (response: any) => {
        console.log('✅ PR created from comparison:', response);
        this.showToastMessage(`PR created for RFQ ${comparisonData.rfqNo}`, 'success');
      },
      error: (error) => {
        console.error('❌ Error creating PR:', error);
        // ✅ Fallback - Save PR locally
        this.savePRToStorage(prData);
      }
    });
  }

  private savePRToStorage(prData: any) {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = localStorage.getItem('pr_requests');
      const all = existing ? JSON.parse(existing) : [];
      const idx = all.findIndex((r: any) => r.comparisonId === prData.comparisonId);
      if (idx >= 0) {
        all[idx] = prData;
      } else {
        all.unshift(prData);
      }
      localStorage.setItem('pr_requests', JSON.stringify(all));
      console.log('💾 PR saved to localStorage:', prData.rfqNo);
    } catch (error) {
      console.error('❌ Error saving PR to localStorage:', error);
    }
  }

  private persistCurrent() {
    if (!this.current) return;
    const { t1, t2, t3 } = this.getTotals();
    const positives = [t1, t2, t3].filter(v => v > 0);
    this.current.totalAmount = positives.length ? Math.min(...positives) : 0;
    this.current.bestSupplier = this.getBestSupplier();

    const idx = this.allRequests.findIndex(r => r.id === this.current!.id);
    const snapshot: QuotationRequest = JSON.parse(JSON.stringify(this.current));
    if (idx >= 0) this.allRequests[idx] = snapshot;
    else this.allRequests.unshift(snapshot);
    this.saveRequestsToStorage();
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
  getStatusClass(status: string): string {
    return status === 'Submitted' ? 'submitted' : 'pending';
  }
}