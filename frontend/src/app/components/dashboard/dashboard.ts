import { Component, OnInit, HostListener, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

// Import all components
import { EPApprovalComponent } from "../ep-approval/ep-approval";
import { NppProcurementComponent } from "../npp-procurement/npp-procurement.component";
import { Bidding } from "../bidding/bidding";
import { PaymentRequest } from "../payment-request/payment-request";
import { Dqms } from "../dqms/dqms";
import { Npi } from "../npi/npi";
import { SystemBom } from "../system-bom/system-bom";
import { BomForecast } from "../bom-forecast/bom-forecast";
import { PriceApproval } from "../price-approval/price-approval";
import { PlanStock } from "../plan-stock/plan-stock";
import { SupplierPerformance } from "../supplier-performance/supplier-performance";
import { VehicularMs } from "../vehicular-ms/vehicular-ms";
import { RfqComponent } from "../../components/rfq/Rfq.component";
import { PartsComponent } from "../parts/parts";
import { UserManagementComponent } from "../user-management/user-management";
import { ProfileComponent } from "../profile/Profile.component";
import { VendorsComponent } from "../vendors/VendorsComponent";

// Cache keys & TTL
const CK = {
  stats:    'lcgc_dash_stats',
  requests: 'lcgc_dash_requests',
  vendors:  'lcgc_dash_vendors',
  parts:    'lcgc_dash_parts',
};
const CACHE_TTL = 5 * 60 * 1000;

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  icon: string;
}

interface PurchaseOrder {
  id: string;
  vendorName: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderDate: string;
  status: 'delivered' | 'pending' | 'processing';
}

interface VendorSuggestion {
  vendorName: string;
  itemName: string;
  price: number;
  rating: number;
  deliveryTime: string;
  suggested: boolean;
}

interface UnifiedRequest {
  id: string;
  type: 'ep' | 'rfq' | 'npp' | 'pr' | 'po' | 'payment';
  uniqueSerialNo?: string;
  title: string;
  requester: string;
  email: string;
  department: string;
  priority: string;
  status: string;
  amount: number;
  requestDate: string;
  vendor?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    EPApprovalComponent,
    NppProcurementComponent,
    RfqComponent,
    UserManagementComponent,
    Bidding, PaymentRequest, Dqms, Npi, SystemBom, BomForecast, PriceApproval,
    PlanStock, SupplierPerformance, VehicularMs,
    ProfileComponent,
    PartsComponent,
    VendorsComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // ---- TAB STATE: 'dashboard' shows main dashboard, other values show module tabs ----
  activeTab: string = 'dashboard';
  activeSubTab: string = 'ep-approval';
  showMobileMenu: boolean = false;
  userName: string = '';
  userRole: string = '';
  userInitials: string = '';
  userEmail: string = '';
  userRights: any = {};
  dashboardData: any = {};
  isLoading = false;
  searchTerm: string = '';
  greeting: string = '';
  accessDeniedMessage: string = '';

  toasts: Toast[] = [];
  private toastIdCounter = 0;

  showBirthdayBanner: boolean = false;
  userAge: number | null = null;
  userBirthday: string = '';
  birthdayMessage: string = '';

  openDropdown: string | null = null;
  showUserMenu: boolean = false;

  showRightsRequestModal: boolean = false;
  requestingModuleId: string = '';
  requestingModuleName: string = '';
  requestReason: string = '';
  isSubmittingRequest: boolean = false;

  // Profile modal
  showProfileModal: boolean = false;
  profileInitialTab: 'profile' | 'password' = 'profile';

  private apiUrl = environment.apiUrl;

  // Dynamic data
  isStatsLoading   = true;
  isRecentLoading  = true;
  isVendorLoading  = true;
  isPartLoading    = true;

  displayTotalRequests: number | null = null;
  displayPending:       number | null = null;
  displayApproved:      number | null = null;
  displaySuccessRate:   number | null = null;

  recentRequests: any[] = [];
  activityFeed: { icon: string; text: string; time: string; type: string }[] = [];

  currentTime = '';
  currentDate = '';
  private clockInterval: any;
  private refreshInterval: any;

  vendorCount: number | null = null;
  partCount:   number | null = null;

  // New Dashboard Data
  recentPurchaseOrders: PurchaseOrder[] = [];
  vendorSuggestions: VendorSuggestion[] = [];
  approvalStatsByType: any = {
    epApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 },
    rfqApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 },
    nppApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 }
  };

  chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    requests: [12, 19, 15, 25, 22, 30],
    approved: [8, 14, 10, 20, 18, 25],
    rejected: [4, 5, 5, 5, 4, 5]
  };

  // Unified Section Properties — shown INSIDE dashboard tab
  activeSection: 'requests' | 'approvals' | 'status' = 'requests';
  unifiedSearchTerm = '';
  unifiedTypeFilter: 'all' | 'ep' | 'rfq' | 'npp' | 'pr' | 'po' | 'payment' = 'all';

  unifiedRequests: UnifiedRequest[] = [];
  filteredUnifiedRequests: UnifiedRequest[] = [];
  filteredUnifiedApprovals: UnifiedRequest[] = [];
  filteredUnifiedStatuses: UnifiedRequest[] = [];

  // Whether the approvals section is visible inside dashboard
  showApprovalsSection: boolean = false;

  unifiedStats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    inProcess: 0
  };

  selectedUnifiedRequest: UnifiedRequest | null = null;
  showUnifiedViewModal = false;

  // Menus
  allMenuItems = [
    { id: 'ep-approval',          name: 'EP Approval',             icon: '📋', category: 'procurement', rightKey: 'epApproval' },
    { id: 'vendors',              name: 'Vendors',                 icon: '🏢', category: 'master',      rightKey: 'vendors' },
    { id: 'parts',                name: 'Parts',                   icon: '🔧', category: 'master',      rightKey: 'parts' },
    { id: 'rfq',                  name: 'NON BOM (RFQ)',           icon: '📄', category: 'procurement', rightKey: 'rfq' },
    { id: 'user-management',      name: 'User Management',         icon: '👥', category: 'admin',       rightKey: 'userManagement' },
    { id: 'npp-procurement',      name: 'NPP Procurement',         icon: '🛒', category: 'procurement', rightKey: 'nppProcurement' },
    { id: 'bidding',              name: 'Bidding: Scrap Material', icon: '🏷️', category: 'procurement', rightKey: 'bidding' },
    { id: 'payment-request',      name: 'Payment Request',         icon: '💰', category: 'finance',     rightKey: 'paymentRequest' },
    { id: 'dqms',                 name: 'DQMS',                    icon: '✅', category: 'quality',     rightKey: 'dqms' },
    { id: 'npi',                  name: 'NPI',                     icon: '🔬', category: 'engineering', rightKey: 'npi' },
    { id: 'system-bom',           name: 'System BOM',              icon: '📊', category: 'engineering', rightKey: 'systemBom' },
    { id: 'bom-forecast',         name: 'BOM Part Forecasting',    icon: '📈', category: 'engineering', rightKey: 'bomForecast' },
    { id: 'price-approval',       name: 'Price Approval',          icon: '💲', category: 'finance',     rightKey: 'priceApproval' },
    { id: 'plan-stock',           name: 'Plan Vs Stock',           icon: '📉', category: 'inventory',   rightKey: 'planStock' },
    { id: 'supplier-performance', name: 'Supplier Performance',    icon: '⭐', category: 'procurement', rightKey: 'supplierPerformance' },
    { id: 'vehicular-ms',         name: 'Vehicular - MS',          icon: '🚗', category: 'logistics',   rightKey: 'vehicularMs' }
  ];

  menuItems: any[] = [];

  menuStructure: { name: string; hasDropdown: boolean; icon: string; moduleId?: string; modules?: string[] }[] = [
    { name: 'Dashboard',      hasDropdown: false, icon: '🏠', moduleId: 'dashboard' },
    { name: 'Procurement',    hasDropdown: true,  icon: '🛒', modules: ['ep-approval','rfq','npp-procurement','bidding','supplier-performance'] },
    { name: 'Master Data',    hasDropdown: true,  icon: '📚', modules: ['vendors','parts'] },
    { name: 'Engineering',    hasDropdown: true,  icon: '🔧', modules: ['npi','system-bom','bom-forecast'] },
    { name: 'Quality',        hasDropdown: true,  icon: '✅', modules: ['dqms'] },
    { name: 'Finance',        hasDropdown: true,  icon: '💰', modules: ['payment-request','price-approval'] },
    { name: 'Inventory',      hasDropdown: true,  icon: '📦', modules: ['plan-stock'] },
    { name: 'Logistics',      hasDropdown: true,  icon: '🚚', modules: ['vehicular-ms'] },
    { name: 'Administration', hasDropdown: true,  icon: '⚙️', modules: ['user-management'] }
  ];

  approvalWorkflow = [
    { line: 'Parallel',   stakeholder: 'Vijay Parashar',    remarks: 'okay, urgent support Required', designation: 'Manager', status: 'Approved', dateTime: '2-23-26 9:30 AM' },
    { line: 'Parallel',   stakeholder: 'Ravib',             remarks: 'okay',                          designation: 'A-GM',    status: 'Approved', dateTime: '2-23-26 9:55 AM' },
    { line: 'Sequential', stakeholder: 'Shailendra Chothe', remarks: 'OK',                            designation: 'VP',      status: 'Approved', dateTime: '2-23-26 2:30 PM' }
  ];

  pendingRightsRequests: any[] = [];
  nonBomQuickLinks: { name: string; moduleId?: string; section?: 'requests' | 'approvals' | 'status'; label?: string }[] = [
    { name: 'RFQ Request', moduleId: 'rfq' },
    { name: 'PR process', moduleId: 'npp-procurement' },
    { name: 'Material Management', moduleId: 'npp-procurement' },
    { name: 'Report', section: 'requests' },
    { name: 'Work Completion Certificate (WCC)', moduleId: 'payment-request' },
    { name: 'Scrap Material Bidding', moduleId: 'bidding' },
    { name: 'Item Master List (Part List)', moduleId: 'parts' },
    { name: 'Vendor details', moduleId: 'vendors' },
    { name: 'Approval Status', section: 'status' }
  ];

  get isAdminView(): boolean {
    return this.isAdminOrManager();
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  @HostListener('document:click')
  onDocumentClick() { this.closeDropdown(); }

  ngOnInit() {
    this.loadUserInfo();
    this.loadUserRights();
    this.setGreeting();
    this.checkBirthday();
    this.startClock();
    this.loadPurchaseOrdersAndSuggestions();

    this.paintFromCache();
    this.loadAllParallel();

    if (this.isAdminOrManager()) {
      setTimeout(() => this.loadPendingRightsRequests(), 300);
    }

    this.refreshInterval = setInterval(() => this.loadAllParallel(), 2 * 60 * 1000);
  }

  ngOnDestroy() {
    if (this.clockInterval)   clearInterval(this.clockInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  // ====================== FORMATTING METHODS ======================

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  }

  formatAmount(amount?: number): string {
    if (!amount) return '₹0';
    return '₹' + amount.toLocaleString('en-IN');
  }

  getTypeIcon(type: string): string {
    const icons: any = { 'ep': '📋', 'rfq': '📄', 'npp': '🛒', 'pr': '🧾', 'po': '📦', 'payment': '💰' };
    return icons[type] || '📌';
  }

  getTypeLabel(type: string): string {
    const labels: any = { ep: 'EP', rfq: 'RFQ', npp: 'NPP', pr: 'PR', po: 'PO', payment: 'Payment' };
    return labels[type] || type.toUpperCase();
  }

  getUnifiedStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    if (s === 'in-process' || s === 'in process') return 'in-process';
    return 'pending';
  }

  getPriorityClass(p: string): string {
    const x = (p || 'Medium').toLowerCase();
    if (x === 'high' || x === 'urgent') return 'high';
    if (x === 'low') return 'low';
    return 'medium';
  }

  // ====================== UNIFIED SECTION METHODS ======================

  /**
   * Switch the active section tab (requests / approvals / status)
   * and make sure the approvals panel is visible inside the dashboard.
   */
  setActiveSection(section: 'requests' | 'approvals' | 'status') {
    this.activeSection = section;
    this.showApprovalsSection = true;
    // Always stay on dashboard tab when switching sections
    if (this.activeTab !== 'dashboard') {
      this.activeTab = 'dashboard';
    }
    this.loadUnifiedData();
  }

  /**
   * Called from the Approvals nav dropdown.
   * Switches to dashboard tab and shows the approvals panel.
   */
  openApprovalSection(section: 'requests' | 'approvals' | 'status') {
    this.activeTab = 'dashboard';
    this.showApprovalsSection = true;
    this.activeSection = section;
    this.loadUnifiedData();
    this.closeDropdown();
  }

  loadUnifiedData() {
    const startedAt = Date.now();
    this.isLoading = true;

    forkJoin({
      ep: this.authService.getAllEPApprovalRequests().pipe(timeout(10000), catchError(() => of([]))),
      rfq: this.authService.getRFQs().pipe(timeout(10000), catchError(() => of([]))),
      npp: this.authService.getNppRequests().pipe(timeout(10000), catchError(() => of([])))
    }).subscribe(({ ep, rfq, npp }) => {
      const epData = (ep?.data || ep || []).map((r: any) => this.mapToUnified(r, 'ep'));
      const rfqData = (rfq?.data || rfq || []).map((r: any) => this.mapToUnified(r, 'rfq'));
      const nppData = (npp?.data || npp || []).map((r: any) => this.mapToUnified(r, 'npp'));
      const localHistoryData = this.loadLocalOrderHistory();
      const formTemplateData = this.getApprovalFormTemplates();

      this.unifiedRequests = [...epData, ...rfqData, ...nppData, ...localHistoryData, ...formTemplateData];
      this.updateUnifiedStats();
      this.applyUnifiedFilters();
      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(0, 5000 - elapsed);
      setTimeout(() => {
        this.isLoading = false;
        this.showToast(`Loaded ${this.unifiedRequests.length} requests (EP, RFQ, NPP).`, 'success');
        this.cdr.detectChanges();
      }, waitMs);
    }, () => {
      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(0, 5000 - elapsed);
      setTimeout(() => {
        this.isLoading = false;
        this.showToast('Failed to load unified approvals data.', 'error');
        this.cdr.detectChanges();
      }, waitMs);
    });
  }

  private mapToUnified(r: any, type: string): UnifiedRequest {
    const priorityMap: any = { 'H': 'High', 'M': 'Medium', 'L': 'Low' };
    const source = String(r.source || r.type || '').toLowerCase();
    const derivedType =
      source.includes('payment') ? 'payment' :
      source.includes('po') ? 'po' :
      source.includes('pr') ? 'pr' :
      source.includes('rfq') ? 'rfq' :
      type;
    return {
      id: r._id || r.id,
      type: derivedType as UnifiedRequest['type'],
      uniqueSerialNo: r.uniqueSerialNo || r.serialNo || '',
      title: r.title || r.titleOfActivity || r.subject || '—',
      requester: r.requester || r.requesterName || r.createdBy?.name || '—',
      email: r.email || r.emailId || '',
      department: r.department || r.dept || '—',
      priority: priorityMap[r.priority] || r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: Number(r.amount || r.estimatedAmount || 0),
      requestDate: r.requestDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      vendor: r.vendor || r.vendorName
    };
  }

  private loadLocalOrderHistory(): UnifiedRequest[] {
    try {
      const history = JSON.parse(localStorage.getItem('npp_order_history') || '[]');
      if (!Array.isArray(history)) return [];
      return history.map((item: any, index: number) => ({
        id: item.id || item.uniqueSerialNo || `local-history-${index}`,
        type: (item.type || 'npp') as UnifiedRequest['type'],
        uniqueSerialNo: item.uniqueSerialNo || '',
        title: item.title || item.data?.rfqNppForm?.titleOfActivity || item.data?.prRequestForm?.titleOfActivity || item.data?.poNppForm?.titleOfActivity || item.data?.paymentAdviseForm?.titleOfActivity || 'Saved NON-BOM Request',
        requester: item.data?.rfqNppForm?.requesterName || item.data?.prRequestForm?.requesterName || item.data?.poNppForm?.requesterName || item.data?.paymentAdviseForm?.requesterName || this.userName || '—',
        email: item.data?.rfqNppForm?.emailId || item.data?.prRequestForm?.emailId || item.data?.poNppForm?.emailId || item.data?.paymentAdviseForm?.emailId || this.userEmail || '',
        department: item.data?.rfqNppForm?.department || item.data?.prRequestForm?.department || item.data?.poNppForm?.department || item.data?.paymentAdviseForm?.department || '—',
        priority: 'Medium',
        status: item.status || 'Pending',
        amount: 0,
        requestDate: item.submittedDate || new Date().toISOString(),
        vendor: item.data?.poNppForm?.vendorName || item.data?.paymentAdviseForm?.paymentTo || ''
      }));
    } catch {
      return [];
    }
  }

  private getApprovalFormTemplates(): UnifiedRequest[] {
    const today = new Date().toISOString();
    const templates: Array<{ id: string; type: UnifiedRequest['type']; title: string; department: string; vendor?: string }> = [
      { id: 'form-ep-approval', type: 'ep', title: 'EP Approval Form', department: 'General' },
      { id: 'form-rfq', type: 'rfq', title: 'RFQ Request Form', department: 'Purchase' },
      { id: 'form-cash-purchase', type: 'npp', title: 'Cash Purchase-NPP Form', department: 'Purchase' },
      { id: 'form-new-vendor', type: 'npp', title: 'New Vendor Approval-NPP Form', department: 'Purchase' },
      { id: 'form-request-quotation', type: 'rfq', title: 'Request for Quotation-NPP Form', department: 'Purchase' },
      { id: 'form-requisition-rfq', type: 'rfq', title: 'Requisition RFQ-NPP Form', department: 'Purchase' },
      { id: 'form-vendor-list', type: 'npp', title: 'Vendor List-NPP Form', department: 'Purchase' },
      { id: 'form-employee-detail', type: 'npp', title: 'Employee Detail Form', department: 'HR' },
      { id: 'form-item-master', type: 'npp', title: 'Item Master List-NPP Form', department: 'Purchase' },
      { id: 'form-quotation-comparison', type: 'pr', title: 'Quotation Cost Comparison Form', department: 'Purchase' },
      { id: 'form-pr-request', type: 'pr', title: 'PR Request-NPP Form', department: 'Purchase' },
      { id: 'form-po', type: 'po', title: 'PO-NPP Form', department: 'Purchase' },
      { id: 'form-payment-advice', type: 'payment', title: 'Payment Advice Form', department: 'Finance' },
      { id: 'form-wcc', type: 'payment', title: 'WCC-NPP Form', department: 'Finance' }
    ];

    return templates.map(t => ({
      id: t.id,
      type: t.type,
      uniqueSerialNo: 'FORM',
      title: t.title,
      requester: 'Create Form',
      email: '',
      department: t.department,
      priority: 'Medium',
      status: 'Pending',
      amount: 0,
      requestDate: today,
      vendor: t.vendor || ''
    }));
  }

  private updateUnifiedStats() {
    this.unifiedStats = {
      total: this.unifiedRequests.length,
      pending: this.unifiedRequests.filter(r => r.status === 'Pending').length,
      approved: this.unifiedRequests.filter(r => r.status === 'Approved').length,
      rejected: this.unifiedRequests.filter(r => r.status === 'Rejected').length,
      inProcess: this.unifiedRequests.filter(r => r.status === 'In Process' || r.status === 'In-Process').length
    };
  }

  applyUnifiedFilters() {
    let list = [...this.unifiedRequests];

    if (this.unifiedTypeFilter !== 'all') {
      list = list.filter(r => r.type === this.unifiedTypeFilter);
    }

    if (this.unifiedSearchTerm.trim()) {
      const q = this.unifiedSearchTerm.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    }

    this.filteredUnifiedRequests = list;
    this.filteredUnifiedApprovals = list.filter(r => r.status === 'Pending' || r.status === 'In Process' || r.status === 'In-Process');
    this.filteredUnifiedStatuses = list;
    this.cdr.detectChanges();
  }

  // Helper methods for template
  getTypeCount(type: string): number {
    return this.unifiedRequests.filter(r => r.type === type).length;
  }

  getTypePendingCount(type: string): number {
    return this.unifiedRequests.filter(r => r.type === type && (r.status === 'Pending' || r.status === 'In Process')).length;
  }

  getStatusCount(status: string): number {
    return this.unifiedRequests.filter(r => r.status === status).length;
  }

  getApprovalRateFromUnified(): number {
    if (this.unifiedStats.total === 0) return 0;
    return Math.round((this.unifiedStats.approved / this.unifiedStats.total) * 100);
  }

  viewUnifiedRequest(req: UnifiedRequest) {
    this.selectedUnifiedRequest = req;
    this.showUnifiedViewModal = true;
  }

  closeUnifiedViewModal() {
    this.showUnifiedViewModal = false;
    this.selectedUnifiedRequest = null;
  }

  approveUnifiedRequest(req: UnifiedRequest) {
    const requestId = req.id;

    if (!requestId) {
      this.showToast('Invalid request ID', 'error');
      return;
    }

    let approvalObservable;

    if (req.type === 'ep') {
      approvalObservable = this.authService.approveEPRequest(requestId);
    } else if (req.type === 'rfq') {
      approvalObservable = this.authService.approveRFQ(requestId);
    } else if (req.type === 'npp' || req.type === 'pr' || req.type === 'po' || req.type === 'payment') {
      approvalObservable = this.authService.approveNppRequest(requestId);
    } else {
      this.showToast('Unknown request type', 'error');
      return;
    }

    approvalObservable.subscribe({
      next: () => {
        this.showToast(`${req.type.toUpperCase()} request approved successfully!`, 'success');
        this.loadUnifiedData();
      },
      error: (err: any) => {
        const errorMsg = err?.message || 'Approval failed';
        this.showToast(errorMsg, 'error');
      }
    });
  }

  rejectUnifiedRequest(req: UnifiedRequest) {
    const requestId = req.id;

    if (!requestId) {
      this.showToast('Invalid request ID', 'error');
      return;
    }

    let rejectionObservable;

    if (req.type === 'ep') {
      rejectionObservable = this.authService.rejectEPRequest(requestId);
    } else if (req.type === 'rfq') {
      rejectionObservable = this.authService.rejectRFQ(requestId);
    } else if (req.type === 'npp' || req.type === 'pr' || req.type === 'po' || req.type === 'payment') {
      rejectionObservable = this.authService.rejectNppRequest(requestId);
    } else {
      this.showToast('Unknown request type', 'error');
      return;
    }

    rejectionObservable.subscribe({
      next: () => {
        this.showToast(`${req.type.toUpperCase()} request rejected`, 'info');
        this.loadUnifiedData();
      },
      error: (err: any) => {
        const errorMsg = err?.message || 'Rejection failed';
        this.showToast(errorMsg, 'error');
      }
    });
  }

  openEPCreateModal() {
    this.activeTab = 'ep-approval';
    this.showApprovalsSection = false;
    setTimeout(() => {
      const epComponent = document.querySelector('app-ep-approval') as any;
      if (epComponent && epComponent.openCreateModal) {
        epComponent.openCreateModal();
      }
    }, 100);
  }

  // ====================== END UNIFIED SECTION METHODS ======================

  private loadPurchaseOrdersAndSuggestions() {
    this.recentPurchaseOrders = [
      { id: 'PO-001', vendorName: 'Steel Corp Ltd', itemName: 'Steel Sheets', quantity: 500, unitPrice: 120, totalPrice: 60000, orderDate: '2026-04-15', status: 'delivered' },
      { id: 'PO-002', vendorName: 'ElectroMart', itemName: 'Circuit Boards', quantity: 200, unitPrice: 450, totalPrice: 90000, orderDate: '2026-04-14', status: 'processing' },
      { id: 'PO-003', vendorName: 'PackPro', itemName: 'Packaging Boxes', quantity: 1000, unitPrice: 25, totalPrice: 25000, orderDate: '2026-04-13', status: 'delivered' },
      { id: 'PO-004', vendorName: 'Tech Solutions', itemName: 'Laptops', quantity: 10, unitPrice: 55000, totalPrice: 550000, orderDate: '2026-04-12', status: 'pending' }
    ];

    this.vendorSuggestions = [
      { vendorName: 'Steel Corp Ltd', itemName: 'Steel Sheets', price: 120, rating: 4.5, deliveryTime: '3 days', suggested: true },
      { vendorName: 'Metal Masters', itemName: 'Steel Sheets', price: 115, rating: 4.2, deliveryTime: '5 days', suggested: false },
      { vendorName: 'ElectroMart', itemName: 'Circuit Boards', price: 450, rating: 4.8, deliveryTime: '2 days', suggested: true },
      { vendorName: 'Circuit World', itemName: 'Circuit Boards', price: 430, rating: 4.3, deliveryTime: '4 days', suggested: false }
    ];
  }

  getApprovalProgress(stats: any): string {
    if (!stats || !stats.total) return '0%';
    return ((stats.approved / stats.total) * 100) + '%';
  }

  selectVendor(suggestion: any) {
    this.showToast(`Vendor ${suggestion.vendorName} selected for ${suggestion.itemName}`, 'success');
    this.navigateToModule('rfq');
  }

  private paintFromCache() {
    const stats    = this.readCache(CK.stats);
    const requests = this.readCache(CK.requests);
    const vendors  = this.readCache(CK.vendors);
    const parts    = this.readCache(CK.parts);

    if (stats) {
      this.applyStats(stats);
      this.isStatsLoading = false;
    }
    if (requests?.length) {
      this.buildRequests(requests);
      this.isRecentLoading = false;
    }
    if (vendors !== null && vendors !== undefined) {
      this.vendorCount     = vendors;
      this.isVendorLoading = false;
    }
    if (parts !== null && parts !== undefined) {
      this.partCount     = parts;
      this.isPartLoading = false;
    }
  }

  loadAllParallel() {
    const T = 5000;

    forkJoin({
      stats:    this.authService.getDashboardData()        .pipe(timeout(T), catchError(() => of(null))),
      requests: this.authService.getAllEPApprovalRequests() .pipe(timeout(T), catchError(() => of(null))),
      vendors:  this.authService.getVendors()              .pipe(timeout(T), catchError(() => of(null))),
      parts:    this.authService.getParts()                .pipe(timeout(T), catchError(() => of(null))),
    }).subscribe(({ stats, requests, vendors, parts }) => {

      if (stats) {
        const d = (stats?.success && (stats.data || stats.totalRequests !== undefined))
          ? (stats.data && typeof stats.data === 'object' ? stats.data : stats)
          : stats;

        if (d && (d.totalRequests != null || d.pending != null || d.approved != null)) {
          this.applyStats(d);
          this.writeCache(CK.stats, d);
        }
      }
      if (this.displayTotalRequests === null) this.displayTotalRequests = 0;
      if (this.displayPending       === null) this.displayPending       = 0;
      if (this.displayApproved      === null) this.displayApproved      = 0;
      if (this.displaySuccessRate   === null) this.displaySuccessRate   = 0;
      this.isStatsLoading = false;

      if (requests) {
        const all: any[] = requests?.data || (Array.isArray(requests) ? requests : []);
        if (all.length) { this.buildRequests(all); this.writeCache(CK.requests, all); }
        this.updateApprovalStats(all);
      }
      this.isRecentLoading = false;

      if (vendors) {
        const vd: any[] = vendors?.data || (Array.isArray(vendors) ? vendors : []);
        this.vendorCount = vd.length;
        this.writeCache(CK.vendors, vd.length);
      }
      if (this.vendorCount === null) this.vendorCount = 0;
      this.isVendorLoading = false;

      if (parts) {
        const pd: any[] = parts?.data || (Array.isArray(parts) ? parts : []);
        this.partCount = pd.length;
        this.writeCache(CK.parts, pd.length);
      }
      if (this.partCount === null) this.partCount = 0;
      this.isPartLoading = false;
    });
  }

  private updateApprovalStats(requests: any[]) {
    this.approvalStatsByType.epApprovals = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'Pending').length,
      approved: requests.filter(r => r.status === 'Approved').length,
      rejected: requests.filter(r => r.status === 'Rejected').length
    };

    this.authService.getRFQs().subscribe((res: any) => {
      const rfqData = res?.data || [];
      this.approvalStatsByType.rfqApprovals = {
        total: rfqData.length,
        pending: rfqData.filter((r: any) => r.status === 'Pending' || r.status === 'In-Process').length,
        approved: rfqData.filter((r: any) => r.status === 'Approved').length,
        rejected: rfqData.filter((r: any) => r.status === 'Rejected').length
      };
    });

    this.authService.getNppRequests().subscribe((res: any) => {
      const nppData = res?.data || [];
      this.approvalStatsByType.nppApprovals = {
        total: nppData.length,
        pending: nppData.filter((r: any) => r.status === 'Pending').length,
        approved: nppData.filter((r: any) => r.status === 'Approved').length,
        rejected: nppData.filter((r: any) => r.status === 'Rejected').length
      };
    });
  }

  private applyStats(d: any) {
    this.dashboardData        = d;
    this.displayTotalRequests = d.totalRequests ?? d.total ?? 0;
    this.displayPending       = d.pending       ?? 0;
    this.displayApproved      = d.approved      ?? 0;
    this.displaySuccessRate   = d.successRate   ?? d.success_rate ?? 0;
  }

  private buildRequests(all: any[]) {
    this.recentRequests = [...all]
      .sort((a, b) =>
        new Date(b.requestDate || b.createdAt || 0).getTime() -
        new Date(a.requestDate || a.createdAt || 0).getTime()
      ).slice(0, 5);

    this.activityFeed = this.recentRequests.map(r => ({
      icon: this.getStatusIcon(r.status),
      text: `${r.requester || 'Someone'} — "${r.title || 'EP Request'}"`,
      time: this.getRelativeTime(r.requestDate || r.createdAt),
      type: (r.status || 'pending').toLowerCase()
    }));
  }

  private writeCache(key: string, value: any) {
    try { localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() })); } catch {}
  }

  private readCache(key: string): any {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { v, t } = JSON.parse(raw);
      return (Date.now() - t) > CACHE_TTL ? null : v;
    } catch { return null; }
  }

  startClock() { this.updateClock(); this.clockInterval = setInterval(() => this.updateClock(), 1000); }

  updateClock() {
    const n = new Date();
    this.currentTime = n.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
    this.currentDate = n.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  getStatusIcon(s: string): string {
    const icons: any = { 'approved': '✅', 'rejected': '❌', 'in-process': '🔄', 'pending': '⏳' };
    return icons[(s || '').toLowerCase()] || '📋';
  }

  getRelativeTime(d: string): string {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
  }

  getRequestStatusClass(s: string): string { return this.getWorkflowStatusClass(s); }

  formatCurrency(n: number): string {
    if (!n) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  }

  getProgressWidth(v: number | null, max: number | null): string {
    if (!max || v === null || v === undefined) return '0%';
    return Math.min(100, Math.round(v / max * 100)) + '%';
  }

  getApprovalRate(): number {
    const t = this.displayTotalRequests || 0;
    return t ? Math.round((this.displayApproved || 0) / t * 100) : 0;
  }

  getRejected(): number {
    return Math.max(0, (this.displayTotalRequests || 0) - (this.displayApproved || 0) - (this.displayPending || 0));
  }

  getSafeRate(): number { return this.displaySuccessRate || 0; }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast: Toast = {
      id: ++this.toastIdCounter,
      type,
      message,
      icon: icons[type]
    };
    this.toasts.push(toast);
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
    }, duration);
  }

  loadUserInfo() {
    const user = this.authService.getUser();
    if (user) {
      this.userName     = user.name  || 'User';
      this.userRole     = user.role  || 'User';
      this.userEmail    = user.email || '';
      this.userInitials = this.userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      this.userRights   = user.rights || {};
      if (user.dateOfBirth) {
        this.userBirthday = new Date(user.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        this.userAge = user.age || this.calculateAge(user.dateOfBirth);
      }
    } else {
      this.userName = 'User';
      this.userRole = 'User';
      this.userInitials = 'U';
      this.userEmail = '';
      this.userRights = {};
    }
    // Keep rights and profile in sync with backend after login/approval changes
    this.authService.refreshUserRights().subscribe({
      next: () => {
        const refreshed = this.authService.getUser();
        if (!refreshed) return;
        this.userName = refreshed.name || this.userName;
        this.userRole = refreshed.role || this.userRole;
        this.userEmail = refreshed.email || this.userEmail;
        this.userRights = refreshed.rights || {};
        this.userInitials = this.userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  isAdminOrManager(): boolean { return this.userRole === 'Admin' || this.userRole === 'Manager'; }

  calculateAge(dob: string): number {
    const today = new Date(), birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  checkBirthday() {
    const user = this.authService.getUser();
    if (user?.dateOfBirth) {
      const today = new Date(), birth = new Date(user.dateOfBirth);
      if (today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate()) {
        this.showBirthdayBanner = true;
        this.birthdayMessage = this.getBirthdayMessage(user.name);
        setTimeout(() => { this.showBirthdayBanner = false; }, 10000);
      }
    }
  }

  getBirthdayMessage(name: string): string {
    const msgs = [
      `🎉 Happy Birthday, ${name}! 🎂 May your day be filled with joy and celebration!`,
      `🎈 Wishing you a fantastic birthday, ${name}! 🎁 Have a great day!`,
      `🌟 Happy Birthday, ${name}! 🌟 May this year bring you success!`,
      `🎂 It's your special day, ${name}! Happy Birthday from the LCGC team! 🎉`,
      `🥳 Happy Birthday, ${name}! Wishing you happiness and prosperity! 🎈`
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  loadUserRights() {
    const rights = this.authService.getUserRights();
    this.userRights = rights && Object.keys(rights).length ? rights : (this.userRights || {});
    this.menuItems = this.isAdminOrManager()
      ? [...this.allMenuItems]
      : this.allMenuItems.filter(item => this.userRights[item.rightKey] === true);
  }

  setGreeting() {
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  setActiveTab(tab: string) {
    this.activeTab = tab === 'dashboard' ? 'dashboard' : tab;
    this.activeSubTab = tab === 'dashboard' ? '' : tab;
    if (tab === 'dashboard') {
      this.showApprovalsSection = false;
    }
    this.showMobileMenu = false;
    this.closeDropdown();
  }

  navigateToModule(moduleId: string) {
    if (this.hasModuleAccess(moduleId)) {
      this.activeSubTab = moduleId;
      const known = ['ep-approval', 'vendors', 'parts', 'rfq', 'user-management', 'npp-procurement',
        'bidding', 'payment-request', 'dqms', 'npi', 'system-bom', 'bom-forecast',
        'price-approval', 'plan-stock', 'supplier-performance', 'vehicular-ms'];
      this.activeTab = known.includes(moduleId) ? moduleId : 'coming-soon';
      this.showApprovalsSection = false;
    } else {
      this.requestingModuleId = moduleId;
      this.requestingModuleName = this.getModuleName(moduleId);
      this.showRightsRequestModal = true;
    }
    this.closeDropdown();
  }

  openProfile(event: Event) {
    event.stopPropagation();
    this.profileInitialTab = 'profile';
    this.showProfileModal = true;
    this.showUserMenu = false;
  }

  openProfileTab(tab: 'profile' | 'password', event: Event) {
    event.stopPropagation();
    this.profileInitialTab = tab;
    this.showProfileModal = true;
    this.showUserMenu = false;
  }

  closeProfileModal() {
    this.showProfileModal = false;
    this.loadUserInfo();
  }

  closeRightsRequestModal() {
    this.showRightsRequestModal = false;
    this.requestingModuleId = '';
    this.requestingModuleName = '';
    this.requestReason = '';
  }

  submitRightsRequest() {
    if (!this.requestReason.trim()) {
      this.showToast('Please provide a reason for access request.', 'warning');
      return;
    }
    this.isSubmittingRequest = true;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Get current user's full details for proper name/email
    const currentUser = this.authService.getUser();
    const requesterName = currentUser?.name || this.userName || '';
    const requesterEmail = currentUser?.email || this.userEmail || '';

    fetch(`${this.apiUrl}/user-rights`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userRight: this.requestingModuleName,
        code: this.requestingModuleId,
        reason: this.requestReason,
        requestedBy: requesterName,
        requestedByEmail: requesterEmail,
        action: 'Request',
        status: 'In-process'
      })
    }).then(r => r.json()).then(data => {
      this.isSubmittingRequest = false;
      if (data.success) {
        this.showToast(`Access request for "${this.requestingModuleName}" sent to Admin!`, 'success');
        this.closeRightsRequestModal();
      } else {
        this.showToast(data.message || 'Failed to submit request.', 'error');
      }
    }).catch(() => {
      this.isSubmittingRequest = false;
      this.showToast('Network error. Please try again.', 'error');
    });
  }

  loadPendingRightsRequests() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${this.apiUrl}/user-rights`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(r => r.json()).then(data => {
      if (data.success) {
        this.pendingRightsRequests = (data.data || [])
          .filter((r: any) => {
            const s = (r.status || '').toLowerCase().trim().replace(/\s+/g, '-');
            return s === 'in-process' || s === 'pending' || s === 'inprocess';
          })
          .map((r: any) => ({
            ...r,
            requestedByEmail: this.resolveRequestUserEmail(r),
            requestedBy: this.resolveRequestUserName(r)
          }));
        this.cdr.detectChanges();
      }
    }).catch(() => {});
  }

  approveRightsRequest(request: any) {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${this.apiUrl}/user-rights/${request._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ status: 'Approved', action: 'Approved' })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        this.showToast(`✅ Access approved for "${request.userRight}"!`, 'success');
        this.pendingRightsRequests = this.pendingRightsRequests.filter(r => r._id !== request._id);
        this.grantUserRight(request);
        this.loadUserRights();
        this.loadUnifiedData();
      } else {
        this.showToast('Approval failed. Please try again.', 'error');
      }
    }).catch(() => {
      this.showToast('Network error during approval.', 'error');
    });
  }

  rejectRightsRequest(request: any) {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    fetch(`${this.apiUrl}/user-rights/${request._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ status: 'Rejected', action: 'Rejected' })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        this.showToast(`Request for "${request.userRight}" rejected.`, 'info');
        this.pendingRightsRequests = this.pendingRightsRequests.filter(r => r._id !== request._id);
      }
    }).catch(() => {});
  }

  private grantUserRight(request: any) {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const requestedEmail = this.resolveRequestUserEmail(request);

    fetch(`${this.apiUrl}/users`, {
      headers: { 'Authorization': token ? `Bearer ${token}` : '' }
    }).then(r => r.json()).then(data => {
      const users = data.data || data.users || (Array.isArray(data) ? data : []);
      const user = users.find((u: any) =>
        u.email?.toLowerCase() === requestedEmail?.toLowerCase()
      );
      if (!user) return;

      const userId = user._id || user.id;
      const rightKey = this.allMenuItems.find(m => m.id === request.code)?.rightKey;
      if (!rightKey || !userId) return;

      const updatedRights = { ...(user.rights || {}), [rightKey]: true };

      fetch(`${this.apiUrl}/users/${userId}/rights`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ rights: updatedRights })
      }).then(r => r.json()).then(res => {
        if (res?.success) {
          this.authService.refreshAnyUserSession(requestedEmail || '').subscribe({ next: () => {}, error: () => {} });
          const currentUser = this.authService.getUser();
          if (currentUser?.email?.toLowerCase() === requestedEmail?.toLowerCase()) {
            const updatedUser = { ...currentUser, rights: updatedRights };
            const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
            storage.setItem('user_data', JSON.stringify(updatedUser));
            storage.setItem('currentUser', JSON.stringify(updatedUser));
            this.userRights = updatedRights;
            this.loadUserRights();
            this.showToast(`Access to "${request.userRight}" is now active!`, 'success');
          }
        }
      }).catch(() => {});
    }).catch(() => {});
  }

  private resolveRequestUserEmail(request: any): string {
    return request?.requestedByEmail || request?.email || request?.user?.email || '';
  }

  private resolveRequestUserName(request: any): string {
    const direct = request?.requestedBy || request?.name || request?.user?.name;
    if (direct && String(direct).trim() && !String(direct).trim().includes('@')) {
      return String(direct).trim();
    }
    const email = this.resolveRequestUserEmail(request);
    if (!email) return 'Unknown User';
    const local = email.split('@')[0] || '';
    const derived = local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((chunk: string) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
    return derived || email;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleMobileMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  toggleDropdown(menuName: string, event: Event) {
    event.stopPropagation();
    this.openDropdown = this.openDropdown === menuName ? null : menuName;
    this.showUserMenu = false;
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    this.openDropdown = null;
  }

  closeDropdown() {
    this.openDropdown = null;
    this.showUserMenu = false;
  }

  getModuleName(moduleId: string): string {
    return this.allMenuItems.find(m => m.id === moduleId)?.name || moduleId;
  }

  getModuleIcon(moduleId: string): string {
    return this.allMenuItems.find(m => m.id === moduleId)?.icon || '📌';
  }

  hasModuleAccess(moduleId: string): boolean {
    if (this.isAdminOrManager()) return true;
    const module = this.allMenuItems.find(m => m.id === moduleId);
    if (!module) return false;
    const rights = this.authService.getUserRights();
    const effectiveRights = rights && Object.keys(rights).length ? rights : this.userRights;
    return effectiveRights?.[module.rightKey] === true;
  }

  openNonBomLink(link: { moduleId?: string; section?: 'requests' | 'approvals' | 'status' }) {
    if (link.section) {
      this.activeTab = 'dashboard';
      this.setActiveSection(link.section);
      return;
    }
    if (link.moduleId) this.navigateToModule(link.moduleId);
  }

  getAllModulesForMenu(modules: string[] | undefined): any[] {
    if (!modules?.length) return [];
    return modules.map(id => ({
      id,
      name: this.getModuleName(id),
      icon: this.getModuleIcon(id),
      hasAccess: this.hasModuleAccess(id)
    }));
  }

  shouldShowMenu(menu: any): boolean {
    return !menu.hasDropdown || (menu.modules?.length || 0) > 0;
  }

  getWorkflowStatusClass(status: string): string {
    const map: Record<string, string> = {
      'approved': 'status-approved',
      'rejected': 'status-rejected',
      'in-process': 'status-inprocess'
    };
    return map[(status || '').toLowerCase()] || 'status-pending';
  }

  getMenuName(menuId: string): string {
    return this.allMenuItems.find(m => m.id === menuId)?.name || 'Module';
  }

  hasRight(rightKey: string): boolean {
    return this.isAdminOrManager() || this.userRights[rightKey] === true;
  }

  getFirstName(): string {
    return this.userName.split(' ')[0];
  }

  dismissBirthdayBanner() {
    this.showBirthdayBanner = false;
  }

  getUserAvatar(): string {
    return this.authService.getUser()?.avatar || '';
  }
}