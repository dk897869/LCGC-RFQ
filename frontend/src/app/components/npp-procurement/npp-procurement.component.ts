import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth';
import { NonBomNavService, NonBomNavMode } from '../../services/non-bom-nav.service';
import { CashPurchaseComponent } from '../../npp-procurement/components/cash-purchase/cash-purchase';
import { NewVendorComponent } from '../../npp-procurement/components/new-vendor/new-vendor';
import { RfqVendorComponent } from '../../npp-procurement/components/rfq-vendor/rfq-vendor';
import { VendorListComponent } from '../../npp-procurement/components/vendor-list/vendor-list';
import { ItemMasterComponent } from '../../npp-procurement/components/item-master/item-master';
import { QuotationComparisonComponent } from '../../npp-procurement/components/quotation-comparison/quotation-comparison';
import { PrRequest } from '../../npp-procurement/components/pr-request/pr-request';
import { PoNpp } from '../po-npp/po-npp';
import { RequestsListComponent } from '../../npp-procurement/components/requests-list/requests-list';
import { EmployeeDetailComponent } from '../../npp-procurement/components/employee-detail/employee-detail';
import { WccNppComponent } from '../../npp-procurement/components/wcc-npp/wcc-npp';
import { PaymentAdviseComponent } from '../../npp-procurement/components/payment-advise/payment-advise';
import { RfqRequisitionComponent } from "../../npp-procurement/components/rfq-requisition/rfq-requisition";
import { EPApprovalComponent } from '../ep-approval/ep-approval';
import { StatusModalComponent } from '../../shared/status-modal/status-modal.component';
import { QuotationStatusComponent } from "../quotation-status/quotation-status/quotation-status";

export interface WorkflowStep {
  id: string;
  label: string;
  icon: string;
  groupId: string;
}

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  dotClass: 'dot-b' | 'dot-g' | 'dot-a';
  steps: WorkflowStep[];
}

export interface Certificate {
  id: string;
  requestId: string;
  type: string;
  serialNo: string;
  generatedAt: string;
  url: string | null;
}

@Component({
  selector: 'app-npp-procurement',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CashPurchaseComponent,
    NewVendorComponent,
    RfqVendorComponent,
    VendorListComponent,
    ItemMasterComponent,
    QuotationComparisonComponent,
    PrRequest,
    PoNpp,
    RequestsListComponent,
    EmployeeDetailComponent,
    WccNppComponent,
    PaymentAdviseComponent,
    RfqRequisitionComponent,
    EPApprovalComponent,
    StatusModalComponent,
    QuotationStatusComponent
],
  templateUrl: './npp-procurement.html',
  styleUrls: ['./npp-procurement.scss'],
})
export class NppProcurementComponent implements OnInit, OnChanges, OnDestroy {
  @Input() initialTab: string = 'rfq-npp-form';

  activeTab: string = 'rfq-npp-form';
  isLoading = false;
  sidebarOpen = false;
  toast: Toast | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  currentUser: any = null;
  activeGroupId = 'rfq-request';

  // Track which groups are expanded in the accordion
  expandedGroups: Set<string> = new Set(['rfq-request']);

  // Report properties
  reportFilter = { type: 'all', fromDate: '', toDate: '', search: '' };
  reportSummary = { totalRequests: 0, approved: 0, rejected: 0, pending: 0, inProcess: 0 };
  reportRows: any[] = [];
  isReportLoading = false;

  // Certificate properties
  showCertificateModal = false;
  selectedCertificateRequest: any = null;
  certificateList: Certificate[] = [];
  isGeneratingCertificate = false;
  certificatePreviewUrl: string | null = null;

  // Quotation Comparison
  showQuotationModal = false;
  showStatusModal = false;
  statusModalType = 'all';
  epApprovalTab: 'requests' | 'approvals' | 'status' = 'requests';
  vendorSuggestionsList: any[] = [];
  selectedVendor: any = null;
  quotationItems: any[] = [];

  // Quick toast
  quickToast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private quickToastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly navGroups: NavGroup[] = [
    {
      id: 'approvals',
      label: 'Approvals',
      icon: 'OK',
      dotClass: 'dot-g',
      steps: [
        { id: 'ep-request', label: 'Request', icon: 'REQ', groupId: 'approvals' },
        { id: 'ep-approvals', label: 'Approval', icon: 'APR', groupId: 'approvals' },
        { id: 'ep-status', label: 'Status', icon: 'STS', groupId: 'approvals' },
      ]
    },
    {
      id: 'rfq-request',
      label: 'RFQ Request',
      icon: '🔍',
      dotClass: 'dot-b',
      steps: [
        { id: 'rfq-npp-form',          label: 'RFQ (Request for Quotation)',                         icon: 'RFQ', groupId: 'rfq-request' },
        { id: 'rfq-vendor-requisition', label: 'Requisition To Vendor',                              icon: 'RTV', groupId: 'rfq-request' },
        { id: 'quotation-status',       label: 'Quotation Status',                                   icon: 'QST', groupId: 'rfq-request' },
        { id: 'quotation-comparison',  label: 'Quotation Collection and Cost Comparison',             icon: 'QC',  groupId: 'rfq-request' },
      ]
    },
    {
      id: 'pr-process',
      label: 'PR Process',
      icon: '📋',
      dotClass: 'dot-g',
      steps: [
        { id: 'pr-request', label: 'PR Process for Approval',    icon: 'PR', groupId: 'pr-process' },
        { id: 'po-npp',     label: 'PO Approval and Generation', icon: 'PO', groupId: 'pr-process' },
      ]
    },
    {
      id: 'material-management',
      label: 'Material Management',
      icon: '🏗️',
      dotClass: 'dot-a',
      steps: [
        { id: 'item-master',      label: 'Material Inward & Inventory Management',    icon: 'IM',  groupId: 'material-management' },
        { id: 'vendor-list',      label: 'Stock inventory and monitoring',             icon: 'VL',  groupId: 'material-management' },
        { id: 'requests-status',  label: 'Material issuing: Based on approval',       icon: 'STS', groupId: 'material-management' },
      ]
    },
    {
      id: 'reports',
      label: 'Report',
      icon: '📊',
      dotClass: 'dot-b',
      steps: [
        { id: 'reports', label: 'RFQ, PR, PO, Payment and stock Status report', icon: 'REP', groupId: 'reports' },
        { id: 'reports', label: 'VI Report (Dept./CMDT)',                        icon: 'VI',  groupId: 'reports' },
        { id: 'reports', label: 'Part Price history',                            icon: 'PPH', groupId: 'reports' },
        { id: 'reports', label: 'Part receiving history',                        icon: 'PRH', groupId: 'reports' },
      ]
    },
    {
      id: 'wcc',
      label: 'Work Completion Certificate (WCC)',
      icon: '✅',
      dotClass: 'dot-g',
      steps: [
        { id: 'wcc-npp',         label: 'Request', icon: 'WCC', groupId: 'wcc' },
        { id: 'requests-status', label: 'Status',  icon: 'STS', groupId: 'wcc' },
      ]
    },
    {
      id: 'scrap-material-bidding',
      label: 'Scrap Material Bidding',
      icon: '🔨',
      dotClass: 'dot-a',
      steps: [
        { id: 'scrap-requisition', label: 'Requisition (Request Creation)',      icon: 'SR',  groupId: 'scrap-material-bidding' },
        { id: 'scrap-quotation',   label: 'Quotation Collection',                icon: 'SQ',  groupId: 'scrap-material-bidding' },
        { id: 'scrap-emd',         label: 'EMD Amount (Earnest Money Deposit)',  icon: 'EMD', groupId: 'scrap-material-bidding' },
        { id: 'scrap-online',      label: 'Online Vendor bidding',               icon: 'OVB', groupId: 'scrap-material-bidding' },
        { id: 'scrap-approval',    label: 'Multi-level Approval',                icon: 'MLA', groupId: 'scrap-material-bidding' },
        { id: 'reports',           label: 'Report',                              icon: 'REP', groupId: 'scrap-material-bidding' },
      ]
    },
    {
      id: 'item-master-list',
      label: 'Item Master List (Part List)',
      icon: '📦',
      dotClass: 'dot-b',
      steps: [
        { id: 'item-master', label: 'New part creation',               icon: 'NEW', groupId: 'item-master-list' },
        { id: 'item-master', label: 'Part Inquiry',                    icon: 'PI',  groupId: 'item-master-list' },
        { id: 'item-master', label: 'Price and SOB detail updating',   icon: 'SOB', groupId: 'item-master-list' },
      ]
    },
    {
      id: 'vendor-details',
      label: 'Vendor Details',
      icon: '👥',
      dotClass: 'dot-g',
      steps: [
        { id: 'vendor-list', label: 'Vendor Inquiry',         icon: 'VI', groupId: 'vendor-details' },
        { id: 'new-vendor',  label: 'New Vendor approval',    icon: 'NV', groupId: 'vendor-details' },
        { id: 'vendor-list', label: 'Vendor detail Updating', icon: 'VU', groupId: 'vendor-details' },
      ]
    },
    {
      id: 'approval-status',
      label: 'Approval Status',
      icon: '🏅',
      dotClass: 'dot-a',
      steps: [
        { id: 'requests-status', label: 'Approval Status', icon: 'APP', groupId: 'approval-status' },
      ]
    },
  ];

  get workflowSteps(): WorkflowStep[] {
    return this.navGroups.flatMap(group => group.steps);
  }

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  readonly navService = inject(NonBomNavService);

  /** Nav groups visible based on smart navigation mode */
  get visibleNavGroups(): NavGroup[] {
    return this.navGroups.filter(g => this.navService.isGroupVisible(g.id));
  }

  ngOnInit(): void {
    this.loadUserInfo();
    this.setInitialTab();
    if (typeof window !== 'undefined') {
      window.addEventListener('app-toast', this.handleToastEvent.bind(this));
      window.addEventListener('npp-navigate-tab', this.handleNavigateTabEvent.bind(this));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialTab'] && !changes['initialTab'].firstChange) {
      this.setInitialTab();
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.quickToastTimer) clearTimeout(this.quickToastTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('app-toast', this.handleToastEvent.bind(this));
      window.removeEventListener('npp-navigate-tab', this.handleNavigateTabEvent.bind(this));
    }
  }

  private handleToastEvent(event: any) {
    const { message, type } = event.detail;
    this.showQuickToast(message, type);
  }

  private handleNavigateTabEvent(event: any) {
    const tabId = event.detail;
    const step = this.workflowSteps.find(s => s.id === tabId);
    if (step) {
      this.setActiveTab(step.id, step.groupId);
    }
  }

  loadUserInfo(): void {
    this.currentUser = this.authService.getUser();
  }

  private setInitialTab(): void {
    const mode = this.navService.resolveModeFromTab(this.initialTab);
    if (mode !== 'all') {
      this.navService.setMode(mode);
      this.setActiveGroupExpand(mode);
      return;
    }
    const requestedGroup = this.navGroups.find(g => g.id === this.initialTab);
    if (requestedGroup) {
      this.navService.setMode(requestedGroup.id as NonBomNavMode);
      this.setActiveGroupExpand(requestedGroup.id);
      return;
    }
    const requestedStep = this.workflowSteps.find(s => s.id === this.initialTab);
    if (requestedStep) {
      this.navService.setMode(requestedStep.groupId as NonBomNavMode);
      this.activeGroupId = requestedStep.groupId;
      this.activeTab = requestedStep.id;
      this.expandedGroups.add(requestedStep.groupId);
      this.syncEpTabFromActive();
    }
  }

  private syncEpTabFromActive(): void {
    if (this.activeTab === 'ep-request') this.epApprovalTab = 'requests';
    if (this.activeTab === 'ep-approvals') this.epApprovalTab = 'approvals';
    if (this.activeTab === 'ep-status') this.epApprovalTab = 'status';
  }

  // ─── Accordion / Nav ─────────────────────────────────────────────────────────

  toggleGroup(groupId: string): void {
    this.navService.setMode(groupId as NonBomNavMode);
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.clear();
      this.expandedGroups.add(groupId);
    }
    this.activeGroupId = groupId;
    const group = this.navGroups.find(g => g.id === groupId);
    if (group?.steps?.length) {
      this.activeTab = group.steps[0].id;
      this.syncEpTabFromActive();
    }
  }

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroups.has(groupId);
  }

  setActiveGroupExpand(groupId: string): void {
    const group = this.navGroups.find(g => g.id === groupId);
    if (!group) return;
    this.navService.setMode(groupId as NonBomNavMode);
    this.activeGroupId = group.id;
    this.activeTab = group.steps[0]?.id || this.activeTab;
    this.expandedGroups.clear();
    this.expandedGroups.add(groupId);
    this.sidebarOpen = false;
    this.syncEpTabFromActive();
  }

  // backToMainMenu(): void {
  //   this.navService.showAll();
  //   this.expandedGroups = new Set(this.navGroups.map(g => g.id));
  //   this.activeGroupId = 'rfq-request';
  //   this.activeTab = 'rfq-npp-form';
  //   this.sidebarOpen = false;
  // }

  setActiveTab(tabId: string, groupId: string): void {
    this.navService.setMode(groupId as NonBomNavMode);
    this.activeGroupId = groupId;
    this.activeTab = tabId;
    this.sidebarOpen = false;
    this.syncEpTabFromActive();
  }

  openStatusModal(type = 'all'): void {
    this.statusModalType = type;
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
  }

  getStatusTypeForActiveTab(): string {
    const map: Record<string, string> = {
      'rfq-npp-form': 'rfq', 'rfq-vendor-requisition': 'rfq', 'quotation-status': 'quotation-status',
      'quotation-comparison': 'comparison', 'pr-request': 'pr', 'po-npp': 'po',
      'payment-advise': 'payment', 'wcc-npp': 'wcc', 'cash-purchase': 'cash-purchase',
      'ep-request': 'ep', 'ep-approvals': 'ep', 'ep-status': 'ep'
    };
    return map[this.activeTab] || 'all';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  getActiveWorkflowLabel(): string {
    return this.workflowSteps.find(s => s.id === this.activeTab)?.label ?? 'NPP Procurement';
  }

  isFormTab(): boolean {
    return ['rfq-npp-form', 'ep-request', 'quotation-comparison', 'pr-request'].includes(this.activeTab);
  }

  getActiveGroup(): NavGroup {
    return this.navGroups.find(g => g.id === this.activeGroupId) || this.navGroups[0];
  }

  getActiveGroupLabel(): string {
    return this.getActiveGroup()?.label || 'NON BOM';
  }

  getUserInitial(): string {
    return this.currentUser?.name?.charAt(0)?.toUpperCase() ?? 'D';
  }

  getUserName(): string {
    return this.currentUser?.name ?? 'Deepak Kumar';
  }

  getUserRole(): string {
    return this.currentUser?.role ?? 'Admin';
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  handleSubmit(event: any): void {
    if (!event?.success) {
      this.showToast(event?.message || 'Submission failed', 'error');
      return;
    }
    const type = this.activeTab === 'quotation-submission'
      ? 'quotation-submission'
      : (event.type || this.activeTab || 'npp-request');
    const payload = this.buildNppPayload(type, event);
    this.isLoading = true;
    const startedAt = Date.now();
    this.cdr.detectChanges();

    this.authService.createNppModuleRequest(type, payload).pipe(timeout(5000)).subscribe({
        next: (res) => {
          const waitMs = Math.max(0, 2000 - (Date.now() - startedAt));
          setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.showToast(`${type} submitted successfully! Serial: ${res?.serialNo || res?.serialNumber || event.serialNo}`, 'success');
            if (type === 'wcc-npp' && res?.serialNo) {
              this.openCertificateModal({ id: res.id, serialNo: res.serialNo, title: event.data?.form?.workDescription || 'Work Completion' });
            }
          }, waitMs);
        },
        error: (err) => {
          const waitMs = Math.max(0, 2000 - (Date.now() - startedAt));
          setTimeout(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
            this.showToast(err?.message || `${type} submit failed`, 'error');
          }, waitMs);
        }
      });
  }

  private buildNppPayload(type: string, event: any): any {
    const data = event.data || {};
    const form = data.form || data.poData || data || {};
    const base = {
      type,
      requesterName: form.requesterName || form.employeeName || this.currentUser?.name || '',
      department: form.department || this.currentUser?.department || 'Purchase',
      emailId: form.emailId || this.currentUser?.email || '',
      requestDate: form.requestDate || form.poDate || new Date().toISOString(),
      contactNo: form.contactNo || '',
      organization: form.organization || 'Radiant Appliances',
      titleOfActivity: form.titleOfActivity || form.purpose || this.getActiveWorkflowLabel(),
      purposeAndObjective: form.purposeAndObjective || form.workDescription || form.remarks || '',
      priority: form.priority || 'M',
      rfqNo: form.rfqNo || form.rfqNumber || data.rfqNo || data.rfqNumber || '',
      stakeholders: data.approvers || data.stakeholders || [],
      amount: Number(form.expenseAmount || form.amount || form.grandTotal || data.grandTotal || 0)
    };
    const typed: Record<string, any> = {
      'cash-purchase':        { cashPurchaseItems: data.items || [] },
      'new-vendor':           { vendorDetails: data.vendorDetails || [] },
      'rfq-vendor':           { rfqVendorItems: data.items || [] },
      'rfq-requisition':      { rfqItems: data.items || [] },
      'quotation-submission': { quotationSubmissionItems: data.items || data.quotationSubmissionItems || [] },
      'quotation-comparison': {
        quotationItems: data.quotationItems || [],
        supplierNames: data.suppliers?.map((s: any) => s.name) || [],
        quotationTerms: data.suppliers?.map((s: any) => s.terms) || [],
        recommendation: data.recommendation || ''
      },
      'pr-request':    { prItems: data.items || [] },
      'po-npp':        { poItems: form.items || [], poVendorDetails: form, amount: Number(form.grandTotal || 0) },
      'payment-advise': {
        paymentDetails: {
          paymentTo: form.paymentTo || form.payableTo || form.employeeName,
          expenseType: form.purpose,
          expenseAmount: form.expenseAmount,
          bankDetails: form.bankDetails || ''
        },
        paymentInvoices: form.invoiceNo ? [{ invoiceNo: form.invoiceNo, invoiceDate: form.invoiceDate, invoiceValue: form.expenseAmount }] : []
      },
      'wcc-npp': {
        wccDetails: { vendorName: form.vendorName, poWoNo: form.poNo, workDescription: form.workDescription, natureOfWork: form.natureOfWork },
        wccEvaluationRows: data.ratings || []
      }
    };
    return { ...base, ...(typed[type] || {}) };
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────

  generateReport(): void {
    this.isReportLoading = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.authService.getReports(this.reportFilter.fromDate, this.reportFilter.toDate, this.reportFilter.type, this.reportFilter.search).subscribe({
        next: (res) => {
          const report = res?.data || {};
          const summary = report.summary || res?.summary || {};
          const details = report.details || report.data || [];
          this.reportSummary = {
            totalRequests: summary.totalRequests ?? summary.total ?? details.length ?? 0,
            approved: summary.approved ?? 0,
            rejected: summary.rejected ?? 0,
            pending: summary.pending ?? 0,
            inProcess: summary.inProcess ?? 0
          };
          this.reportRows = Array.isArray(details) ? details : [];
          this.isReportLoading = false;
          this.cdr.detectChanges();
          this.showQuickToast('Report generated successfully!', 'success');
        },
        error: (err) => {
          this.isReportLoading = false;
          this.cdr.detectChanges();
          this.showToast(err?.message || 'Report generation failed', 'error');
        }
      });
    }, 2000);
  }

  exportReport(): void {
    this.authService.exportReportToCSV(this.reportFilter.fromDate, this.reportFilter.toDate, this.reportFilter.type).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lcgc-report-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.showQuickToast('Report exported!', 'success');
      },
      error: (err) => this.showToast(err?.message || 'Export failed', 'error')
    });
  }

  // ─── Certificates ─────────────────────────────────────────────────────────────

  openCertificateModal(request: any): void {
    this.selectedCertificateRequest = request;
    this.loadCertificates(request.id);
    this.showCertificateModal = true;
  }

  closeCertificateModal(): void {
    this.showCertificateModal = false;
    this.selectedCertificateRequest = null;
    this.certificateList = [];
    this.isGeneratingCertificate = false;
    this.certificatePreviewUrl = null;
  }

  loadCertificates(requestId: string): void {
    this.authService.getCertificates(requestId).subscribe({
      next: (res: any) => { this.certificateList = res?.data || []; },
      error: () => {
        if (typeof localStorage !== 'undefined') {
          const certs = JSON.parse(localStorage.getItem('npp_certificates') || '[]');
          this.certificateList = certs.filter((c: any) => c.requestId == requestId);
        } else {
          this.certificateList = [];
        }
      }
    });
  }

  generateCertificate(): void {
    this.isGeneratingCertificate = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.authService.generateEPCertificate(this.selectedCertificateRequest?.id, this.selectedCertificateRequest).subscribe({
        next: (res: any) => {
          this.isGeneratingCertificate = false;
          this.cdr.detectChanges();
          if (res?.success) {
            this.showQuickToast('Certificate generated!', 'success');
            this.loadCertificates(this.selectedCertificateRequest?.id);
            if (res?.data?.url) {
              this.certificatePreviewUrl = res.data.url;
              setTimeout(() => window.open(res.data.url, '_blank'), 500);
            }
          }
        },
        error: () => {
          this.isGeneratingCertificate = false;
          const mockCert: Certificate = {
            id: 'cert_' + Date.now(),
            requestId: this.selectedCertificateRequest?.id,
            type: 'npp_wcc',
            serialNo: this.selectedCertificateRequest?.serialNo || 'WCC-' + Date.now(),
            generatedAt: new Date().toISOString(),
            url: null
          };
          if (typeof localStorage !== 'undefined') {
            const certs = JSON.parse(localStorage.getItem('npp_certificates') || '[]');
            certs.push(mockCert);
            localStorage.setItem('npp_certificates', JSON.stringify(certs));
          }
          this.certificateList = [mockCert, ...this.certificateList];
          this.cdr.detectChanges();
          this.showQuickToast('Certificate generated (demo mode)', 'info');
        }
      });
    }, 2000);
  }

  previewCertificate(cert: Certificate): void {
    if (cert.url) {
      window.open(cert.url, '_blank');
    } else {
      const pw = window.open('', '_blank');
      if (pw) {
        pw.document.write(`<html><head><title>Certificate - ${cert.serialNo}</title></head>
          <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
          <div style="border:2px solid #0f2a5e;padding:40px;max-width:800px;margin:0 auto;">
          <h1 style="color:#0f2a5e;">WORK COMPLETION CERTIFICATE</h1>
          <p>Serial No: ${cert.serialNo}</p>
          <p>Generated: ${new Date(cert.generatedAt).toLocaleString()}</p>
          <hr><p>This certifies that the work has been completed satisfactorily.</p>
          <p style="margin-top:40px;"><strong>LCGC Resolute Group</strong></p></div></body></html>`);
      }
    }
  }

  downloadCertificate(cert: Certificate): void {
    this.authService.downloadCertificate(cert.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `certificate_${cert.serialNo}.pdf`; a.click();
        window.URL.revokeObjectURL(url);
        this.showQuickToast('Download started!', 'success');
      },
      error: () => {
        const content = `CERTIFICATE\nID: ${cert.id}\nSerial: ${cert.serialNo}\nDate: ${cert.generatedAt}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `certificate_${cert.serialNo}.txt`; a.click();
        window.URL.revokeObjectURL(url);
        this.showQuickToast('Downloaded as text (demo)', 'info');
      }
    });
  }

  // ─── Quotation ────────────────────────────────────────────────────────────────

  openQuotationComparison(items: any[]): void {
    this.quotationItems = items;
    this.loadVendorSuggestions(items);
    this.showQuotationModal = true;
  }

  closeQuotationModal(): void {
    this.showQuotationModal = false;
    this.vendorSuggestionsList = [];
    this.selectedVendor = null;
  }

  loadVendorSuggestions(items: any[]): void {
    this.authService.getVendorSuggestions(items).subscribe({
      next: (res: any) => { this.vendorSuggestionsList = res?.data || []; },
      error: () => {
        this.vendorSuggestionsList = [
          { vendorName: 'ABC Suppliers',    itemName: items[0]?.name || 'Materials', price: 12500, rating: 4.5, deliveryTime: '3 days', suggested: true,  savings: 0    },
          { vendorName: 'XYZ Traders',      itemName: items[0]?.name || 'Materials', price: 11800, rating: 4.2, deliveryTime: '5 days', suggested: false, savings: 700  },
          { vendorName: 'PQR Enterprises',  itemName: items[0]?.name || 'Materials', price: 13200, rating: 4.0, deliveryTime: '2 days', suggested: false, savings: -700 },
          { vendorName: 'LMN Corporation',  itemName: items[0]?.name || 'Materials', price: 12100, rating: 4.3, deliveryTime: '4 days', suggested: false, savings: 400  },
        ];
      }
    });
  }

  selectVendorWithSuggestion(vendor: any): void {
    this.selectedVendor = vendor;
    const best = this.vendorSuggestionsList.find(v => v.suggested);
    if (best && best.vendorName !== vendor.vendorName && best.price < vendor.price) {
      const savings = vendor.price - best.price;
      if (confirm(`⚠️ Better option!\n\n${best.vendorName} offers ₹${best.price.toLocaleString()} (Save ₹${savings.toLocaleString()})\n\nSelect ${best.vendorName} instead?`)) {
        this.selectedVendor = best;
        this.showQuickToast(`Selected ${best.vendorName} – Saving ₹${savings.toLocaleString()}`, 'success');
      } else {
        this.showQuickToast(`Selected ${vendor.vendorName}`, 'info');
      }
    } else {
      this.showQuickToast(`Selected ${vendor.vendorName}`, 'success');
    }
    this.showQuotationModal = false;
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => { this.toast = null; this.cdr.detectChanges(); }, 5000);
  }

  showQuickToast(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.quickToastTimer) clearTimeout(this.quickToastTimer);
    this.quickToast = { message, type };
    this.cdr.detectChanges();
    this.quickToastTimer = setTimeout(() => { this.quickToast = null; this.cdr.detectChanges(); }, 3000);
  }

  closeToast(): void {
    this.toast = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  closeQuickToast(): void {
    this.quickToast = null;
    if (this.quickToastTimer) clearTimeout(this.quickToastTimer);
  }

  // ─── Misc ─────────────────────────────────────────────────────────────────────

  refreshData(): void {
    if (this.isLoading) return;
    if (this.activeTab === 'reports') { this.generateReport(); return; }
    this.isLoading = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
      this.showQuickToast('Data refreshed!', 'success');
    }, 1000);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB');
  }

  formatAmount(amount?: number): string {
    if (!amount) return '₹0';
    return '₹' + amount.toLocaleString('en-IN');
  }

  isScrapTab(): boolean {
    return ['scrap-requisition','scrap-quotation','scrap-emd','scrap-online','scrap-approval'].includes(this.activeTab);
  }
}