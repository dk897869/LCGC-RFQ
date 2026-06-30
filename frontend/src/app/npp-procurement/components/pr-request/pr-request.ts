import { Component, EventEmitter, OnInit, Output, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

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
  comparisonId?: string;
  quotationData?: any;
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

  // ---------------- comparison data ----------------
  comparisonData: any = null;
  isLoadingComparison = false;

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
    titleOfActivity: 'PR Process for Approval',
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
  uomOptions: string[] = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Pcs', 'Set', 'Unit', 'Hour'];

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe
  ) {}

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
      if (this.showListView) {
        this.loadAll();
      }
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

  // ====================== API INTEGRATION ======================

  loadAll(): void {
    this.isLoading = true;
    this.fetchPRsFromAPI();
  }

  fetchPRsFromAPI(): void {
    console.log('🔄 Fetching PRs from API...');
    
    this.authService.getPrList().subscribe({
      next: (res: any) => {
        console.log('✅ PRs fetched from API:', res);
        this.isLoading = false;
        
        if (res?.success && res?.data) {
          this.allPRs = Array.isArray(res.data) ? res.data : [];
        } else if (Array.isArray(res)) {
          this.allPRs = res;
        } else if (res?.items) {
          this.allPRs = res.items;
        } else {
          this.loadFromStorage();
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error fetching PRs:', error);
        this.isLoading = false;
        this.loadFromStorage();
        this.showToastMessage('Using cached data. Please check connection.', 'error');
      }
    });
  }

  // ====================== LOCAL STORAGE FALLBACK ======================

  loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.allPRs = [];
      return;
    }
    try {
      const saved = localStorage.getItem('pr_requests');
      this.allPRs = saved ? JSON.parse(saved) : [];
      console.log('📦 Loaded from localStorage:', this.allPRs.length);
    } catch (error) {
      console.error('❌ Error loading from localStorage:', error);
      this.allPRs = [];
    }
  }

  saveToStorage(pr: PrRequestData): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = localStorage.getItem('pr_requests');
      const all = existing ? JSON.parse(existing) : [];
      const idx = all.findIndex((r: any) => r.id === pr.id);
      if (idx >= 0) {
        all[idx] = pr;
      } else {
        all.unshift(pr);
      }
      localStorage.setItem('pr_requests', JSON.stringify(all));
      console.log('💾 Saved to localStorage:', pr.serialNo);
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
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
    this.fetchPRsFromAPI();
    setTimeout(() => {
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
    this.comparisonData = null;
    this.submitSuccess = false;
    this.loadAll();
    this.cdr.detectChanges();
  }

  openForm(): void {
    const user = this.authService.getUser();
    this.newPR = {
      id: '',
      prNumber: '',
      serialNo: '',
      name: user?.name || '',
      requestDate: this.today,
      department: user?.department || 'Purchase',
      contactNo: user?.contactNo || '',
      emailId: user?.email || '',
      organization: user?.organization || 'Radiant Appliances',
      departmentBudget: 1500000,
      costCenter: 'Purchase Department',
      rfqNo: '',
      titleOfActivity: 'PR Process for Approval',
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
    this.comparisonData = null;
    this.generateSerialNo();
    this.showListView = false;
    this.showFormView = true;
    this.currentPR = null;
    this.cdr.detectChanges();
  }

  editPR(pr: PrRequestData): void {
    console.log('✏️ Editing PR:', pr);
    this.currentPR = JSON.parse(JSON.stringify(pr));
    this.comparisonData = null;
    this.showListView = false;
    this.showFormView = true;
    
    if (pr.rfqNo || pr.comparisonId) {
      this.loadComparisonData(pr.rfqNo || pr.comparisonId || '');
    }
    
    this.cdr.detectChanges();
  }

  viewPR(pr: PrRequestData): void {
    console.log('👁️ Viewing PR:', pr);
    this.currentPR = JSON.parse(JSON.stringify(pr));
    this.comparisonData = null;
    this.showListView = false;
    this.showFormView = true;
    
    if (pr.rfqNo || pr.comparisonId) {
      this.loadComparisonData(pr.rfqNo || pr.comparisonId || '');
    }
    
    this.cdr.detectChanges();
  }

  // ====================== COMPARISON DATA METHODS ======================

  loadComparisonData(rfqId: string): void {
    console.log('📥 Loading comparison data for RFQ:', rfqId);
    
    this.isLoadingComparison = true;
    this.authService.getQuotationComparisonByRfq(rfqId).subscribe({
      next: (res: any) => {
        console.log('✅ Comparison data loaded:', res);
        this.isLoadingComparison = false;
        
        if (res?.success && res?.data) {
          const compData = res.data;
          this.comparisonData = this.processComparisonData(compData);
          
          // Update current PR with comparison data
          if (this.currentPR) {
            this.updatePRFromComparison(compData);
          }
          
          this.cdr.detectChanges();
        } else {
          console.warn('⚠️ No comparison data found for RFQ:', rfqId);
          this.showToastMessage('No comparison data found for this RFQ', 'info');
        }
      },
      error: (error) => {
        console.error('❌ Error loading comparison data:', error);
        this.isLoadingComparison = false;
        this.loadComparisonFromStorage(rfqId);
      }
    });
  }

  processComparisonData(compData: any): any {
    const suppliers = compData.suppliers || [];
    const items = compData.quotationItems || [];
    
    // Calculate supplier totals
    const totals: number[] = [];
    suppliers.forEach((supplier: string, idx: number) => {
      let total = 0;
      items.forEach((item: any) => {
        const price = idx === 0 ? item.supplier1Price : 
                     idx === 1 ? item.supplier2Price : 
                     item.supplier3Price || 0;
        total += (price || 0) * (item.qty || 1);
      });
      totals.push(total);
    });
    
    // Calculate max savings
    const validTotals = totals.filter(t => t > 0);
    const maxSavings = validTotals.length >= 2 ? 
      Math.max(...validTotals) - Math.min(...validTotals) : 0;
    
    return {
      ...compData,
      supplierTotals: totals,
      maxSavings: maxSavings,
      suppliers: suppliers,
      items: items,
      bestSupplier: compData.bestSupplier || (suppliers.length > 0 ? suppliers[0] : ''),
      selectedSupplier: compData.selectedSupplier || compData.bestSupplier || (suppliers.length > 0 ? suppliers[0] : ''),
      recommendation: compData.recommendation || `It is recommended to place the order on ${compData.bestSupplier || 'the best priced vendor'} based on lowest total cost.`
    };
  }

  updatePRFromComparison(compData: any): void {
    if (!this.currentPR) return;
    
    // Update title
    if (compData.title) {
      this.currentPR.titleOfActivity = compData.title;
    }
    
    // Update requester info
    if (compData.requester) {
      this.currentPR.name = compData.requester;
    }
    if (compData.department) {
      this.currentPR.department = compData.department;
    }
    if (compData.requesterEmail) {
      this.currentPR.emailId = compData.requesterEmail;
    }
    
    // Update RFQ No
    if (compData.rfqNo) {
      this.currentPR.rfqNo = compData.rfqNo;
    }
    
    // Update items from comparison
    if (compData.quotationItems && compData.quotationItems.length > 0) {
      const bestSupplier = compData.bestSupplier || compData.suppliers?.[0] || '';
      
      this.currentPR.items = compData.quotationItems.map((item: any, index: number) => ({
        id: index + 1,
        rfqNo: compData.rfqNo || this.currentPR!.rfqNo || '',
        supplierName: bestSupplier || item.supplierName || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || '',
        cndt: item.specification || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        currency: 'INR',
        unitPrice: item.supplier1Price || 0,
        value: (item.qty || 1) * (item.supplier1Price || 0)
      }));
      
      // Calculate total
      this.currentPR.totalValue = this.currentPR.items.reduce((sum, item) => sum + (item.value || 0), 0);
      
      this.showToastMessage(`Loaded ${this.currentPR.items.length} items from comparison`, 'success');
    }
  }

  loadComparisonFromStorage(rfqId: string): void {
    try {
      const stored = localStorage.getItem('quotation_comparison_requests');
      if (stored) {
        const comparisons = JSON.parse(stored);
        const comparison = comparisons.find((c: any) => c.rfqNo === rfqId || c.rfqId === rfqId);
        
        if (comparison) {
          this.comparisonData = this.processComparisonData(comparison);
          
          if (this.currentPR) {
            this.updatePRFromComparison(comparison);
            this.cdr.detectChanges();
            this.showToastMessage(`Loaded ${this.currentPR.items.length} items from local comparison`, 'success');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading comparison from localStorage:', error);
    }
  }

  // ====================== COMPARISON TABLE HELPERS ======================

  getSupplierPrice(item: any, index: number): number {
    if (!item || !this.comparisonData) return 0;
    if (index === 0) return item.supplier1Price || 0;
    if (index === 1) return item.supplier2Price || 0;
    if (index === 2) return item.supplier3Price || 0;
    return 0;
  }

  getSupplierAmount(item: any, index: number): number {
    const price = this.getSupplierPrice(item, index);
    const qty = item.qty || 1;
    return price * qty;
  }

  isLowestPrice(item: any, index: number): boolean {
    if (!item || !this.comparisonData) return false;
    const prices = [
      item.supplier1Price || 0,
      item.supplier2Price || 0,
      item.supplier3Price || 0
    ].filter(p => p > 0);
    if (prices.length === 0) return false;
    const min = Math.min(...prices);
    const currentPrice = this.getSupplierPrice(item, index);
    return currentPrice > 0 && currentPrice === min;
  }

  isBestSupplierTotal(index: number): boolean {
    if (!this.comparisonData) return false;
    const totals = this.comparisonData.supplierTotals || [];
    const validTotals = totals.filter((t: number) => t > 0);
    if (validTotals.length === 0) return false;
    const min = Math.min(...validTotals);
    return totals[index] > 0 && totals[index] === min;
  }

  getSupplierTotal(index: number): number {
    if (!this.comparisonData) return 0;
    const totals = this.comparisonData.supplierTotals || [];
    return totals[index] || 0;
  }

  // ====================== FORM ACTIONS ======================

  addItem(): void {
    const target = this.currentPR || this.newPR;
    const newId = Math.max(...target.items.map(i => i.id), 0) + 1;
    target.items.push({
      id: newId,
      rfqNo: target.rfqNo || '',
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

    this.authService.savePR(pr).subscribe({
      next: (res: any) => {
        console.log('✅ PR Draft saved:', res);
        this.saveToStorage(pr);
        this.submitSuccess = true;
        this.showToastMessage('Draft saved successfully!', 'success');
        setTimeout(() => {
          this.submitSuccess = false;
          this.showListViewScreen();
        }, 1500);
      },
      error: (error) => {
        console.error('❌ Error saving draft:', error);
        this.saveToStorage(pr);
        this.submitSuccess = true;
        this.showToastMessage('Draft saved locally!', 'success');
        setTimeout(() => {
          this.submitSuccess = false;
          this.showListViewScreen();
        }, 1500);
      }
    });
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

    pr.status = 'Pending';
    pr.id = pr.id || `PR-${Date.now()}`;
    pr.serialNo = pr.serialNo || this.currentSerialNo;
    pr.prNumber = pr.serialNo;
    pr.submittedDate = new Date().toISOString();

    this.authService.submitPR(pr).subscribe({
      next: (res: any) => {
        console.log('✅ PR Submitted:', res);
        this.saveToStorage(pr);
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
      },
      error: (error) => {
        console.error('❌ Error submitting PR:', error);
        this.saveToStorage(pr);
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.showToastMessage('PR saved locally! Will sync when online.', 'info');
        setTimeout(() => {
          this.submitSuccess = false;
          this.showListViewScreen();
        }, 1500);
      }
    });
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

  // ====================== COMPARISON DISPLAY HELPERS ======================

  getComparisonSupplierName(index: number): string {
    if (!this.comparisonData) return 'Supplier ' + (index + 1);
    const suppliers = this.comparisonData.suppliers || [];
    return suppliers[index] || 'Supplier ' + (index + 1);
  }

  getComparisonSuppliers(): string[] {
    if (!this.comparisonData) return [];
    return this.comparisonData.suppliers || [];
  }

  getComparisonItems(): any[] {
    if (!this.comparisonData) return [];
    return this.comparisonData.items || [];
  }

  getBestSupplier(): string {
    if (!this.comparisonData) return '';
    return this.comparisonData.bestSupplier || '';
  }

  getSelectedSupplier(): string {
    if (!this.comparisonData) return '';
    return this.comparisonData.selectedSupplier || '';
  }

  getMaxSavings(): number {
    if (!this.comparisonData) return 0;
    return this.comparisonData.maxSavings || 0;
  }

  getRecommendation(): string {
    if (!this.comparisonData) return '';
    return this.comparisonData.recommendation || '';
  }

  hasComparisonData(): boolean {
    return !!this.comparisonData && !!this.comparisonData.suppliers && this.comparisonData.suppliers.length > 0;
  }
}