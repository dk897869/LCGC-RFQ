// dashboard.ts - Complete Dashboard Component with Working Dropdown Menus
import {
  Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

// Child Components
import { EPApprovalComponent } from '../ep-approval/ep-approval';
import { NppProcurementComponent } from '../npp-procurement/npp-procurement.component';
import { Bidding } from '../bidding/bidding';
import { PaymentRequest } from '../payment-request/payment-request';
import { Dqms } from '../dqms/dqms';
import { Npi } from '../npi/npi';
import { SystemBom } from '../system-bom/system-bom';
import { BomForecast } from '../bom-forecast/bom-forecast';
import { PriceApproval } from '../price-approval/price-approval';
import { PlanStock } from '../plan-stock/plan-stock';
import { SupplierPerformance } from '../supplier-performance/supplier-performance';
import { VehicularMs } from '../vehicular-ms/vehicular-ms';
import { RfqComponent } from '../../components/rfq/Rfq.component';
import { PartsComponent } from '../parts/parts';
import { UserManagementComponent } from '../user-management/user-management';
import { ProfileComponent } from '../profile/Profile.component';
import { VendorsComponent } from '../vendors/VendorsComponent';
import { ApprovalsComponent } from '../approvals/approvals';
import { PoNpp } from '../po-npp/po-npp';
import { WccCertificate } from '../wcc-certificate/wcc-certificate';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  icon: string;
}

interface DropdownItem {
  id: string;
  label: string;
  icon: string;
  action: string;
}

interface UnifiedRequest {
  id: string;
  type: 'ep' | 'rfq' | 'npp' | 'pr' | 'po' | 'payment' | 'wcc' | 'comparison';
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
  selected?: boolean;
  rawData?: any;
}

interface Certificate {
  id: string;
  requestId: string;
  generatedAt: string;
  url: string | null;
  data: any;
}

interface ActivityItem {
  icon: string;
  text: string;
  time: string;
  type: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    EPApprovalComponent, RfqComponent, UserManagementComponent,
    Bidding, PaymentRequest, Dqms, Npi, SystemBom, BomForecast,
    PriceApproval, PlanStock, SupplierPerformance, VehicularMs,
    ProfileComponent, PartsComponent, VendorsComponent, ApprovalsComponent,
    PoNpp, WccCertificate, NppProcurementComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  // UI State
  activeTab: string = 'dashboard';
  activeSubTab: string = '';
  sidebarCollapsed: boolean = false;
  showMobileMenu: boolean = false;
  openDropdown: string | null = null;
  showUserMenu: boolean = false;
  activeSection: 'requests' | 'approvals' | 'status' = 'requests';
  showApprovalsSection: boolean = false;
  selectedNppTab: string = 'rfq-npp-form';

  // Dropdown Menu Items
  approvalsDropdownItems: DropdownItem[] = [
    { id: 'request', label: 'Request', icon: '📝', action: 'approvals-request' },
    { id: 'approval', label: 'Approval', icon: '✅', action: 'approvals-approval' },
    { id: 'status', label: 'Status', icon: '📊', action: 'approvals-status' }
  ];

  nonBomDropdownItems: DropdownItem[] = [
    { id: 'rfq-request', label: 'RFQ Request', icon: '📄', action: 'nonbom-rfq-request' },
    { id: 'pr-process', label: 'PR Process', icon: '📋', action: 'nonbom-pr-process' },
    { id: 'material-management', label: 'Material Management', icon: '📦', action: 'nonbom-material-management' },
    { id: 'report', label: 'Report', icon: '📊', action: 'nonbom-report' },
    { id: 'work-completion-certificate', label: 'Work Completion Certificate', icon: '📜', action: 'nonbom-wcc' },
    { id: 'scrap-material-bidding', label: 'Scrap Material Bidding', icon: '🏷️', action: 'nonbom-scrap-bidding' },
    { id: 'item-master-list', label: 'Item Master List', icon: '🔧', action: 'nonbom-item-master' },
    { id: 'vendor-details', label: 'Vendor Details', icon: '🏢', action: 'nonbom-vendor-details' },
    { id: 'approval-status', label: 'Approval Status', icon: '✅', action: 'nonbom-approval-status' }
  ];

  paymentDropdownItems: DropdownItem[] = [
    { id: 'non-bom', label: 'Non-BOM', icon: '📋', action: 'payment-non-bom' },
    { id: 'bom', label: 'BOM', icon: '📊', action: 'payment-bom' },
    { id: 'cash-purchase', label: 'Cash Purchase', icon: '💰', action: 'payment-cash-purchase' },
    { id: 'report', label: 'Report', icon: '📊', action: 'payment-report' },
    { id: 'status', label: 'Status', icon: '✅', action: 'payment-status' }
  ];

  budgetDropdownItems: DropdownItem[] = [
    { id: 'department-budget-request', label: 'Department Budget Request', icon: '💰', action: 'budget-request' },
    { id: 'budget-review', label: 'Budget Review', icon: '🔍', action: 'budget-review' },
    { id: 'department-user-status', label: 'Department User Status', icon: '👥', action: 'budget-status' }
  ];

  // User
  userName: string = '';
  userRole: string = '';
  userInitials: string = '';
  userEmail: string = '';
  userRights: any = {};
  greeting: string = '';
  accessDeniedMessage: string = '';
  showBirthdayBanner: boolean = false;
  userAge: number | null = null;
  userBirthday: string = '';
  birthdayMessage: string = '';

  // Toast
  toasts: Toast[] = [];
  private toastIdCounter = 0;

  // Profile Modal
  showProfileModal: boolean = false;
  profileInitialTab: 'profile' | 'password' = 'profile';

  // Rights Request Modal
  showRightsRequestModal: boolean = false;
  requestingModuleId: string = '';
  requestingModuleName: string = '';
  requestReason: string = '';
  isSubmittingRequest: boolean = false;

  // Loading States
  isLoading = false;
  isStatsLoading = true;
  isRecentLoading = true;
  isVendorLoading = true;
  isPartLoading = true;

  // Dashboard Stats
  dashboardData: any = {};
  displayTotalRequests: number | null = null;
  displayPending: number | null = null;
  displayApproved: number | null = null;
  displaySuccessRate: number | null = null;
  vendorCount: number | null = null;
  partCount: number | null = null;
  recentRequests: any[] = [];
  activityFeed: ActivityItem[] = [];

  // Clock
  currentTime = '';
  currentDate = '';
  private clockInterval: any;
  private refreshInterval: any;

  // Chart
  chartData = {
    labels: ['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026'],
    total: [12, 18, 22, 25, 28, 32],
    approved: [5, 6, 8, 9, 10, 20],
    pending: [7, 12, 14, 16, 18, 12]
  };

  // Approval Stats
  approvalStatsByType: any = {
    epApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 },
    rfqApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 },
    nppApprovals: { total: 0, pending: 0, approved: 0, rejected: 0 }
  };

  // Unified Requests
  unifiedRequests: UnifiedRequest[] = [];
  filteredUnifiedRequests: UnifiedRequest[] = [];
  filteredUnifiedApprovals: UnifiedRequest[] = [];
  filteredUnifiedStatuses: UnifiedRequest[] = [];
  unifiedSearchTerm = '';
  unifiedTypeFilter: 'all' | 'ep' | 'rfq' | 'npp' | 'pr' | 'po' | 'payment' | 'wcc' | 'comparison' = 'all';
  unifiedStats = { total: 0, pending: 0, approved: 0, rejected: 0, inProcess: 0 };

  private readonly demoUnifiedRequests: UnifiedRequest[] = [
    {
      id: 'EP-0010',
      type: 'ep',
      uniqueSerialNo: 'EP/2026/0010',
      title: 'Capital expenditure approval for assembly tooling',
      requester: 'Amit Sharma',
      email: 'amit.sharma@lcgc.local',
      department: 'Production',
      priority: 'High',
      status: 'Approved',
      amount: 485000,
      requestDate: '2026-06-01',
      vendor: 'Radiant Appliances'
    },
    {
      id: 'RFQ-0018',
      type: 'rfq',
      uniqueSerialNo: 'RFQ/2026/0018',
      title: 'RFQ for non-BOM fixture components',
      requester: 'Neha Verma',
      email: 'neha.verma@lcgc.local',
      department: 'Procurement',
      priority: 'Medium',
      status: 'Pending',
      amount: 126000,
      requestDate: '2026-06-03',
      vendor: 'Prime Tech Tools'
    },
    {
      id: 'PR-0126',
      type: 'pr',
      uniqueSerialNo: 'PR/2026/0126',
      title: 'Purchase request for safety consumables',
      requester: 'Ravi Kumar',
      email: 'ravi.kumar@lcgc.local',
      department: 'EHS',
      priority: 'High',
      status: 'Pending',
      amount: 78000,
      requestDate: '2026-06-04'
    },
    {
      id: 'PO-0008',
      type: 'po',
      uniqueSerialNo: 'PO/2026/0008',
      title: 'PO release for calibration services',
      requester: 'Pooja Mehta',
      email: 'pooja.mehta@lcgc.local',
      department: 'Quality',
      priority: 'Low',
      status: 'Approved',
      amount: 92000,
      requestDate: '2026-06-02',
      vendor: 'Metro Calibration Lab'
    },
    {
      id: 'PAY-0042',
      type: 'payment',
      uniqueSerialNo: 'PAY/2026/0042',
      title: 'Payment advise for completed maintenance job',
      requester: 'Sandeep Gill',
      email: 'sandeep.gill@lcgc.local',
      department: 'Maintenance',
      priority: 'Medium',
      status: 'Rejected',
      amount: 54000,
      requestDate: '2026-05-29',
      vendor: 'Apex Services'
    },
    {
      id: 'WCC-0005',
      type: 'wcc',
      uniqueSerialNo: 'WCC/2026/0005',
      title: 'Work completion certificate for civil repair',
      requester: 'Meena Singh',
      email: 'meena.singh@lcgc.local',
      department: 'Projects',
      priority: 'Medium',
      status: 'In Process',
      amount: 218000,
      requestDate: '2026-06-05',
      vendor: 'BuildWell Infra'
    }
  ];

  selectedUnifiedRequest: UnifiedRequest | null = null;
  showUnifiedViewModal = false;
  isEditMode = false;
  editedRequestData: any = {};
  approvalRemarks = '';

  // Bulk Selection
  selectAllChecked: boolean = false;
  showBulkActions: boolean = false;

  // Certificate
  showCertificateModal = false;
  selectedCertificateRequest: any = null;
  certificateList: Certificate[] = [];
  isGeneratingCertificate = false;
  certificatePreviewUrl: string | null = null;

  // Reports
  showReportsModal = false;
  reportType: 'ep' | 'rfq' | 'all' = 'all';
  reportData: any = null;
  isLoadingReport = false;

  // Pending Rights
  pendingRightsRequests: any[] = [];

  // Approval Workflow
  approvalWorkflow = [
    { line: 'Parallel', stakeholder: 'Vijay Parashar', remarks: 'okay, urgent support Required', designation: 'Manager', status: 'Approved', dateTime: '2-23-26 9:30 AM' },
    { line: 'Parallel', stakeholder: 'Ravib', remarks: 'okay', designation: 'A-GM', status: 'Approved', dateTime: '2-23-26 9:55 AM' },
    { line: 'Sequential', stakeholder: 'Shailendra Chothe', remarks: 'OK', designation: 'VP', status: 'Approved', dateTime: '2-23-26 2:30 PM' }
  ];

  // All Menu Items
  allMenuItems = [
    { id: 'ep-approval', name: 'EP Approval', icon: '📋', category: 'procurement', rightKey: 'epApproval' },
    { id: 'vendors', name: 'Vendors', icon: '🏢', category: 'master', rightKey: 'vendors' },
    { id: 'parts', name: 'Parts', icon: '🔧', category: 'master', rightKey: 'parts' },
    { id: 'rfq', name: 'NON BOM (RFQ)', icon: '📄', category: 'procurement', rightKey: 'rfq' },
    { id: 'user-management', name: 'User Management', icon: '👥', category: 'admin', rightKey: 'userManagement' },
    { id: 'npp-procurement', name: 'NPP Procurement', icon: '🛒', category: 'procurement', rightKey: 'nppProcurement' },
    { id: 'po-npp', name: 'PO Process', icon: '📦', category: 'procurement', rightKey: 'nppProcurement' },
    { id: 'wcc', name: 'WCC Certificate', icon: '📜', category: 'procurement', rightKey: 'nppProcurement' },
    { id: 'bidding', name: 'Bidding: Scrap Material', icon: '🏷️', category: 'procurement', rightKey: 'bidding' },
    { id: 'payment-request', name: 'Payment Request', icon: '💰', category: 'finance', rightKey: 'paymentRequest' },
    { id: 'dqms', name: 'DQMS', icon: '✅', category: 'quality', rightKey: 'dqms' },
    { id: 'npi', name: 'NPI', icon: '🔬', category: 'engineering', rightKey: 'npi' },
    { id: 'system-bom', name: 'System BOM', icon: '📊', category: 'engineering', rightKey: 'systemBom' },
    { id: 'bom-forecast', name: 'BOM Part Forecasting', icon: '📈', category: 'engineering', rightKey: 'bomForecast' },
    { id: 'price-approval', name: 'Price Approval', icon: '💲', category: 'finance', rightKey: 'priceApproval' },
    { id: 'plan-stock', name: 'Plan Vs Stock', icon: '📉', category: 'inventory', rightKey: 'planStock' },
    { id: 'supplier-performance', name: 'Supplier Performance', icon: '⭐', category: 'procurement', rightKey: 'supplierPerformance' },
    { id: 'vehicular-ms', name: 'Vehicular - MS', icon: '🚗', category: 'logistics', rightKey: 'vehicularMs' }
  ];

  menuItems: any[] = [];

  get isAdminView(): boolean {
    return ['Admin', 'Manager', 'Senior Manager'].includes(this.userRole);
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('app-toast', this.handleToastEvent.bind(this));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DROPDOWN METHODS - FIXED AND WORKING
  // ─────────────────────────────────────────────────────────────────────────

  toggleDropdown(menuId: string, event: Event) {
    event.stopImmediatePropagation();
    this.openDropdown = this.openDropdown === menuId ? null : menuId;
    console.log('Dropdown toggled:', menuId, 'open:', this.openDropdown);
  }

  handleDropdownAction(action: string) {
    console.log('Dropdown action:', action);
    this.openDropdown = null;

    switch(action) {
      case 'approvals-request':
        this.openApprovalSection('requests');
        break;
      case 'approvals-approval':
        this.openApprovalSection('approvals');
        break;
      case 'approvals-status':
        this.openApprovalSection('status');
        break;
      case 'nonbom-rfq-request':
        this.navigateToNppTab('rfq-request');
        break;
      case 'nonbom-pr-process':
        this.navigateToNppTab('pr-process');
        break;
      case 'nonbom-material-management':
        this.navigateToNppTab('material-management');
        break;
      case 'nonbom-report':
        this.navigateToNppTab('reports');
        break;
      case 'nonbom-wcc':
        this.navigateToNppTab('wcc');
        break;
      case 'nonbom-scrap-bidding':
        this.navigateToNppTab('scrap-material-bidding');
        break;
      case 'nonbom-item-master':
        this.navigateToNppTab('item-master-list');
        break;
      case 'nonbom-vendor-details':
        this.navigateToNppTab('vendor-details');
        break;
      case 'nonbom-approval-status':
        this.navigateToNppTab('approval-status');
        break;
      case 'payment-non-bom':
        this.navigateToModule('payment-request');
        break;
      case 'payment-bom':
        this.showToast('BOM Payment module coming soon', 'info');
        break;
      case 'payment-cash-purchase':
        this.navigateToNppTab('cash-purchase');
        break;
      case 'payment-report':
        this.openReportsModal();
        break;
      case 'payment-status':
        this.openApprovalSection('status');
        break;
      case 'budget-request':
        this.showToast('Department Budget Request coming soon', 'info');
        break;
      case 'budget-review':
        this.showToast('Budget Review coming soon', 'info');
        break;
      case 'budget-status':
        this.showToast('Department User Status coming soon', 'info');
        break;
      default:
        console.log('Unknown action:', action);
    }
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    this.openDropdown = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.sb-nav-item--has-dropdown') && !target.closest('.sb-dropdown')) {
      this.openDropdown = null;
    }
    if (!target.closest('.topbar__user')) {
      this.showUserMenu = false;
    }
  }

  trackByToast(index: number, toast: Toast) {
    return toast.id;
  }

  trackByDropdownItem(index: number, item: DropdownItem) {
    return item.id;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION METHODS
  // ─────────────────────────────────────────────────────────────────────────

  setActiveTab(tab: string) {
    this.activeTab = tab === 'dashboard' ? 'dashboard' : tab;
    this.activeSubTab = tab === 'dashboard' ? '' : tab;
    if (tab === 'dashboard') this.showApprovalsSection = false;
    this.showMobileMenu = false;
    this.openDropdown = null;
  }

  navigateToModule(moduleId: string) {
    if (this.hasModuleAccess(moduleId)) {
      this.activeSubTab = moduleId;
      const known = ['ep-approval', 'vendors', 'parts', 'rfq', 'user-management', 'npp-procurement',
        'po-npp', 'wcc', 'bidding', 'payment-request', 'dqms', 'npi', 'system-bom', 'bom-forecast',
        'price-approval', 'plan-stock', 'supplier-performance', 'vehicular-ms'];
      this.activeTab = known.includes(moduleId) ? moduleId : 'coming-soon';
      this.showApprovalsSection = false;
    } else {
      this.requestingModuleId = moduleId;
      this.requestingModuleName = this.getModuleName(moduleId);
      this.showRightsRequestModal = true;
    }
    this.openDropdown = null;
  }

  navigateToNppTab(tabId: string) {
    const validTabs = [
      'rfq-npp-form', 'pr-request', 'new-vendor', 'rfq-request',
      'pr-process', 'material-management', 'reports', 'wcc',
      'scrap-material-bidding', 'item-master-list', 'vendor-details',
      'approval-status', 'rfq-requisition', 'quotation-comparison',
      'po-npp', 'payment-advise', 'wcc-npp', 'requests-status', 'cash-purchase'
    ];

    if (validTabs.includes(tabId)) {
      this.selectedNppTab = tabId;
      this.navigateToModule('npp-procurement');
    } else {
      this.selectedNppTab = 'rfq-npp-form';
      this.navigateToModule('npp-procurement');
    }
  }

  openApprovalsModule() {
    this.activeTab = 'approvals';
    this.showApprovalsSection = false;
    this.openDropdown = null;
  }

openApprovalSection(section: 'requests' | 'approvals' | 'status') {
  this.activeTab = 'dashboard';
  this.showApprovalsSection = true;
  this.activeSection = section;

  if (!this.unifiedRequests.length) {
    this.loadUnifiedData();
  } else {
    this.applyUnifiedFilters();
  }

  this.openDropdown = null;

  setTimeout(() => {
    const sectionElement = document.getElementById('approval-section');

    if (sectionElement) {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, 100);
}

  openReportsModal() {
    this.showReportsModal = true;
    this.generateReport();
    this.openDropdown = null;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.openDropdown = null;
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

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setActiveSection(section: 'requests' | 'approvals' | 'status') {
    this.activeSection = section;
    this.showApprovalsSection = true;
    if (this.activeTab !== 'dashboard') this.activeTab = 'dashboard';
    this.applyUnifiedFilters();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORMATTING METHODS
  // ─────────────────────────────────────────────────────────────────────────

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  formatAmount(amount?: number): string {
    if (!amount) return '₹0';
    return '₹' + amount.toLocaleString('en-IN');
  }

  getTypeLabel(type: string): string {
    const labels: any = { ep: 'EP', rfq: 'RFQ', npp: 'NPP', pr: 'PR', po: 'PO', payment: 'Payment', wcc: 'WCC', comparison: 'Comparison' };
    return labels[type] || type.toUpperCase();
  }

  getUnifiedStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    if (s === 'in-process' || s === 'in process') return 'in-process';
    return 'pending';
  }

  getApprovalRate(): number {
    const t = this.displayTotalRequests || 0;
    return t ? Math.round(((this.displayApproved || 0) / t) * 100) : 0;
  }

  getApprovalProgress(stats: any): string {
    if (!stats || !stats.total) return '0%';
    return ((stats.approved / stats.total) * 100) + '%';
  }

  getBarHeight(value: number, max: number): string {
    return Math.max(4, Math.round((value / max) * 130)) + 'px';
  }

  getWorkflowStatusClass(status: string): string {
    const map: Record<string, string> = { approved: 'status-approved', rejected: 'status-rejected', 'in-process': 'status-inprocess' };
    return map[(status || '').toLowerCase()] || 'status-pending';
  }

  getFirstName(): string {
    return this.userName.split(' ')[0];
  }

  getMenuName(menuId: string): string {
    return this.allMenuItems.find(m => m.id === menuId)?.name || 'Module';
  }

  getModuleName(moduleId: string): string {
    return this.allMenuItems.find(m => m.id === moduleId)?.name || moduleId;
  }

  getUserAvatar(): string {
    return this.authService.getUser()?.avatar || '';
  }

  hasModuleAccess(moduleId: string): boolean {
    if (this.isAdminView) return true;
    const module = this.allMenuItems.find(m => m.id === moduleId);
    if (!module) return false;
    return this.userRights[module.rightKey] === true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING METHODS
  // ─────────────────────────────────────────────────────────────────────────

  loadUserInfo() {
    const user = this.authService.getUser();
    if (user) {
      this.userName = user.name || 'User';
      this.userRole = user.role || 'User';
      this.userEmail = user.email || '';
      this.userInitials = this.userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      this.userRights = user.rights || {};
    } else {
      this.userName = 'User';
      this.userRole = 'User';
      this.userInitials = 'U';
      this.userEmail = '';
      this.userRights = {};
    }
  }

  loadUserRights() {
    const rights = this.authService.getUserRights();
    this.userRights = rights && Object.keys(rights).length ? rights : (this.userRights || {});
    this.menuItems = this.isAdminView
      ? [...this.allMenuItems]
      : this.allMenuItems.filter(item => this.userRights[item.rightKey] === true);
  }

  setGreeting() {
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  checkBirthday() {
    const user = this.authService.getUser();
    if (user?.dateOfBirth) {
      const today = new Date(), birth = new Date(user.dateOfBirth);
      if (today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate()) {
        this.showBirthdayBanner = true;
        this.birthdayMessage = `🎉 Happy Birthday, ${user.name}! 🎂`;
        setTimeout(() => { this.showBirthdayBanner = false; }, 10000);
      }
    }
  }

  dismissBirthdayBanner() {
    this.showBirthdayBanner = false;
  }

  startClock() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    const n = new Date();
    this.currentTime = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    this.currentDate = n.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  loadUnifiedData() {
    this.unifiedRequests = [...this.demoUnifiedRequests];
    this.updateUnifiedStats();
    this.updateApprovalStatsByType();
    this.applyUnifiedFilters();
    this.isLoading = false;
  }

  applyUnifiedFilters() {
    const term = this.unifiedSearchTerm.trim().toLowerCase();
    const matchesFilter = (request: UnifiedRequest) => {
      const matchesType = this.unifiedTypeFilter === 'all' || request.type === this.unifiedTypeFilter;
      const haystack = [
        request.uniqueSerialNo,
        request.title,
        request.requester,
        request.department,
        request.status,
        request.vendor
      ].join(' ').toLowerCase();

      return matchesType && (!term || haystack.includes(term));
    };

    this.filteredUnifiedRequests = this.unifiedRequests.filter(matchesFilter);
    this.filteredUnifiedApprovals = this.unifiedRequests
      .filter(r => r.status.toLowerCase() === 'approved')
      .filter(matchesFilter);
    this.filteredUnifiedStatuses = this.unifiedRequests.filter(matchesFilter);
    this.cdr.detectChanges();
  }

  private updateUnifiedStats() {
    this.unifiedStats = {
      total: this.unifiedRequests.length,
      pending: this.unifiedRequests.filter(r => r.status === 'Pending').length,
      approved: this.unifiedRequests.filter(r => r.status === 'Approved').length,
      rejected: this.unifiedRequests.filter(r => r.status === 'Rejected').length,
      inProcess: this.unifiedRequests.filter(r => r.status === 'In Process').length
    };
  }

  private updateApprovalStatsByType() {
    const summarize = (types: UnifiedRequest['type'][]) => {
      const requests = this.unifiedRequests.filter(r => types.includes(r.type));
      return {
        total: requests.length,
        pending: requests.filter(r => r.status.toLowerCase() === 'pending').length,
        approved: requests.filter(r => r.status.toLowerCase() === 'approved').length,
        rejected: requests.filter(r => r.status.toLowerCase() === 'rejected').length
      };
    };

    this.approvalStatsByType = {
      epApprovals: summarize(['ep']),
      rfqApprovals: summarize(['rfq']),
      nppApprovals: summarize(['npp', 'pr', 'po', 'payment', 'wcc', 'comparison'])
    };
  }

  loadAllParallel() {
    // Mock data loading
    this.isStatsLoading = false;
    this.isRecentLoading = false;
    this.isVendorLoading = false;
    this.isPartLoading = false;
    this.vendorCount = 24;
    this.partCount = 156;
    this.displayTotalRequests = 156;
    this.displayPending = 23;
    this.displayApproved = 89;
    this.displaySuccessRate = 57;

    this.activityFeed = [
      { icon: '✅', text: 'RFQ Request #RFQ/2026/0010', time: '10 min ago', type: 'approved', color: '#10b981' },
      { icon: '⏳', text: 'PR Request #PR/2026/0126', time: '45 min ago', type: 'pending', color: '#f59e0b' },
      { icon: '📦', text: 'PO Generated #PO/2026/0008', time: '2 hrs ago', type: 'approved', color: '#10b981' },
      { icon: '🏢', text: 'Vendor Added: Radiant Appliances', time: '3 hrs ago', type: 'info', color: '#3b82f6' }
    ];
  }

  generateReport() {
    this.isLoadingReport = true;
    setTimeout(() => {
      this.reportData = {
        summary: { total: 156, approved: 89, rejected: 44, pending: 23 },
        details: []
      };
      this.isLoadingReport = false;
    }, 500);
  }

  exportReportToExcel() {
    this.showToast('Report exported!', 'success');
  }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast: Toast = { id: ++this.toastIdCounter, type, message, icon: icons[type] };
    this.toasts.push(toast);
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
    }, duration);
  }

  private handleToastEvent(event: any) {
    const { message, type } = event.detail;
    this.showToast(message, type);
  }

  viewFullForm(req: UnifiedRequest) {
    this.selectedUnifiedRequest = req;
    this.showUnifiedViewModal = true;
  }

  closeUnifiedViewModal() {
    this.showUnifiedViewModal = false;
    this.selectedUnifiedRequest = null;
  }

  approveUnifiedRequest(req: UnifiedRequest) {
    req.status = 'Approved';
    const request = this.unifiedRequests.find(item => item.id === req.id);
    if (request) request.status = 'Approved';
    this.updateUnifiedStats();
    this.updateApprovalStatsByType();
    this.applyUnifiedFilters();
    this.showToast(`${req.type.toUpperCase()} approved!`, 'success');
    this.closeUnifiedViewModal();
  }

  rejectUnifiedRequest(req: UnifiedRequest) {
    req.status = 'Rejected';
    const request = this.unifiedRequests.find(item => item.id === req.id);
    if (request) request.status = 'Rejected';
    this.updateUnifiedStats();
    this.updateApprovalStatsByType();
    this.applyUnifiedFilters();
    this.showToast(`${req.type.toUpperCase()} rejected`, 'info');
    this.closeUnifiedViewModal();
  }

  openCertificateModal(req: UnifiedRequest) {
    this.selectedCertificateRequest = req;
    this.showCertificateModal = true;
  }

  closeCertificateModal() {
    this.showCertificateModal = false;
    this.selectedCertificateRequest = null;
  }

  generateCertificate() {
    this.isGeneratingCertificate = true;
    setTimeout(() => {
      this.isGeneratingCertificate = false;
      this.showToast('Certificate generated!', 'success');
    }, 2000);
  }

  downloadCertificate(cert: Certificate) {
    this.showToast('Download started!', 'success');
  }

  previewCertificate(cert: Certificate) {
    this.showToast('Preview ready', 'info');
  }

  closeReportsModal() {
    this.showReportsModal = false;
    this.reportData = null;
  }

  submitRightsRequest() {
    if (!this.requestReason.trim()) {
      this.showToast('Please provide a reason', 'warning');
      return;
    }
    this.isSubmittingRequest = true;
    setTimeout(() => {
      this.isSubmittingRequest = false;
      this.showToast('Access request sent!', 'success');
      this.closeRightsRequestModal();
    }, 1000);
  }

  closeRightsRequestModal() {
    this.showRightsRequestModal = false;
    this.requestingModuleId = '';
    this.requestingModuleName = '';
    this.requestReason = '';
  }

  approveRightsRequest(request: any) {
    this.showToast(`Access granted to ${request.requestedBy}`, 'success');
    this.pendingRightsRequests = this.pendingRightsRequests.filter(r => r.id !== request.id);
  }

  rejectRightsRequest(request: any) {
    this.showToast(`Access denied for ${request.requestedBy}`, 'info');
    this.pendingRightsRequests = this.pendingRightsRequests.filter(r => r.id !== request.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadUserInfo();
    this.loadUserRights();
    this.setGreeting();
    this.checkBirthday();
    this.startClock();
    this.loadAllParallel();
    this.loadUnifiedData();
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('app-toast', this.handleToastEvent.bind(this));
    }
  }
}
