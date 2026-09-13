import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { renderFullScreenDocumentViewer } from '../../utils/full-screen-viewer';
import { CreateEPRequestModalComponent } from "../../modals Screen/Create Ep Request/create-ep-request-modal.component";
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

interface Approver {
  id?: number;
  line: 'Parallel' | 'Sequential';
  managerName: string;
  email: string;
  designation: string;
  status: 'pending' | 'approved' | 'rejected' | 'waiting';
  dateTime: string;
  remarks: string;
  contactNo?: string;
  organization?: string;
  showSuggestions?: boolean;
}
interface Attachment {
  id?: number;
  name: string;
  fileSize: string;
  file: File | null;
  preview: string;
  remark: string;
  url?: string;
  fileUrl?: string;
  fileName?: string;
}

interface EPRequest {
  _id?: string;
  id?: string;
  requestId?: string;
  title: string;
  requester: string;
  email?: string;
  department: string;
  vendor?: string;
  amount?: number;
  priority: 'High' | 'Medium' | 'Low' | 'Urgent';
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Process';
  description?: string;
  objective?: string;
  requestDate?: string;
  currentApprover?: string;
  contactNo?: string;
  organization?: string;
  ccList?: string[];
  stakeholders?: any[];
  attachments?: any[];
  createdAt?: string;
  canApprove?: boolean;
  type?: 'EP' | 'RFQ' | 'PR' | 'PO';
}

@Component({
  selector: 'app-ep-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateEPRequestModalComponent],
  templateUrl: './ep-approval.html',
  styleUrls: ['./ep-approval.scss']
})
export class EPApprovalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() initialTab: 'requests' | 'approvals' | 'status' = 'requests';
  @Input() requestView: 'form' | 'list' = 'list';
  @Input() hideInternalSidebar = false;

  activeTab: 'requests' | 'approvals' | 'status' = 'requests';
  
  // Data arrays
  allRequests: EPRequest[] = [];
  filteredRequests: EPRequest[] = [];
  approvalList: EPRequest[] = [];
  statusList: EPRequest[] = [];
  
  // UI State
  isLoading = false;
  searchTerm = '';
  activeFilter: 'All' | 'Approved' | 'Rejected' | 'Pending' | 'In Process' = 'All';
  
  // Modal states
  showCreateModal = false;
  showViewModal = false;
  showApprovalModal = false;
  selectedRequest: EPRequest | null = null;
  approvalAction: 'approve' | 'reject' = 'approve';
  approvalRemarks = '';
  isSubmitting = false;
  
  // Filter states
  filterType = 'All';
  filterPriority = '';
  filterStatus = '';
  filterDepartment = '';
  filterDate = '';
  filterVendor = '';

  statusFilterPriority = '';
  statusFilterStatus = '';
  statusFilterDepartment = '';
  statusFilterSearch = '';
  statusTabFilter: 'All' | 'Approved' | 'Rejected' = 'All';
  statusSearchQuery = '';
  shareEmailAddress = '';
  shareEmailRemarks = '';
  isSharingEmail = false;
  filteredStatusList: EPRequest[] = [];

  // Create Form Data
  formData = {
    requesterName: '',
    department: '',
    emailId: '',
    requestDate: '',
    contactNo: '',
    organization: '',
    titleOfActivity: '',
    vendor: '',
    amount: 0,
    priority: 'High',
    description: '',
    objective: '',
    ccList: [] as string[]
  };
  
  // Approval Chain for Create Form
  approvers: Approver[] = [
    {
      id: 1,
      line: 'Parallel',
      managerName: '',
      email: '',
      designation: '',
      status: 'pending',
      dateTime: '',
      remarks: '',
      contactNo: '',
      organization: ''
    }
  ];
  
  // Attachments for Create Form
  attachments: Attachment[] = [
    {
      id: 1,
      name: 'Attachment 1',
      fileSize: '',
      file: null,
      preview: '',
      remark: ''
    },
    {
      id: 2,
      name: 'Attachment 2',
      fileSize: '',
      file: null,
      preview: '',
      remark: ''
    },
    {
      id: 3,
      name: 'Attachment 3',
      fileSize: '',
      file: null,
      preview: '',
      remark: ''
    }
  ];
  
  // CC Management
  ccInput = '';
  ccList: string[] = [];
  
  // Manager Options
  managerOptions = [
    { name: 'Manoj', email: 'parasharvijaydeep@yahoo.com', designation: 'Engineer', department: 'Store', contactNo: '8807900000', organization: 'Radiant', employeeId: '100845' },
    { name: 'Depak', email: 'parasharvijaydeep@gmail.com', designation: 'Engineer', department: 'Purchase', contactNo: '8807900000', organization: 'Radiant', employeeId: '100846' },
    { name: 'Vijay Deep Parashar', email: 'vijay.parashar@radiantappliances.com', designation: 'Head - Purchase', department: 'Purchase', contactNo: '8807900000', organization: 'Radiant', employeeId: '100847' },
    { name: 'Rajeev Jha', email: 'contact@vdpnexus.com', designation: 'VP-Operation', department: 'Plant Head', contactNo: '8807900000', organization: 'VDP Nexus' }
  ];
  
  priorityOptions = ['High', 'Medium', 'Low', 'Urgent'];
  departmentOptions = ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales', 'Production', 'Quality', 'Logistics'];
  
  currentUser: any = null;
  Math = Math;

  // Media Preview Zoom Modal State
  showMediaModal = false;
  mediaPreviewUrl = '';
  mediaPreviewTitle = '';
  mediaZoomScale = 1;
  isPdfMedia = false;
  isImageMedia = false;
  isOfficeMedia = false;
  officeViewerUrl: SafeResourceUrl | null = null;
  sanitizedMediaUrl: SafeResourceUrl | null = null;

  openMediaPreview(attachmentOrUrl: any, title?: string) {
    console.log('👁️ openMediaPreview triggered in ep-approval component:', attachmentOrUrl, title);
    renderFullScreenDocumentViewer(attachmentOrUrl, title);
  }

  closeMediaPreview() {
    this.showMediaModal = false;
    this.mediaPreviewUrl = '';
    this.mediaPreviewTitle = '';
    this.mediaZoomScale = 1;
    this.sanitizedMediaUrl = null;
    this.officeViewerUrl = null;
    this.isOfficeMedia = false;
    this.isPdfMedia = false;
    this.isImageMedia = false;
    const modalEl = document.getElementById('epApprovalMediaPreviewModal');
    if (modalEl) {
      modalEl.remove();
    }
    this.cdr.markForCheck();
    try { this.cdr.detectChanges(); } catch (e) {}
  }

  zoomInMedia() {
    this.mediaZoomScale = Math.min(3, +(this.mediaZoomScale + 0.25).toFixed(2));
  }

  zoomOutMedia() {
    this.mediaZoomScale = Math.max(0.5, +(this.mediaZoomScale - 0.25).toFixed(2));
  }

  resetMediaZoom() {
    this.mediaZoomScale = 1;
  }
  
  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: any;
  
  // Preview
  showPreview = false;
  previewData: any = null;
  
  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getSanitizedUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url || '');
  }
  
  ngOnInit() {
    this.activeTab = this.initialTab;
    this.currentUser = this.authService.getUser() || {
      name: 'Deepak Kumar',
      email: 'dk897869@gmail.com',
      department: 'IT',
      contactNo: '6239785524',
      organization: 'Radiant Appliances',
      role: 'Manager'
    };
    this.initializeForm();
    this.loadRequests();
    this.loadManagerOptions();
    if (this.showInlineCreateForm) {
      this.initInlineCreateForm();
    }
  }

  get showInlineCreateForm(): boolean {
    return this.requestView === 'form' || (this.hideInternalSidebar && this.activeTab === 'requests');
  }

  initInlineCreateForm(): void {
    this.initializeForm();
    this.approvers = [{
      id: 1, line: 'Parallel', managerName: '', email: '', designation: '',
      status: 'pending', dateTime: '', remarks: ''
    }];
    this.attachments = [
      { id: 1, name: 'Attachment 1', fileSize: '', file: null, preview: '', remark: '' },
      { id: 2, name: 'Attachment 2', fileSize: '', file: null, preview: '', remark: '' },
      { id: 3, name: 'Attachment 3', fileSize: '', file: null, preview: '', remark: '' }
    ];
    this.ccList = [];
    this.ccInput = '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialTab'] && this.initialTab) {
      this.activeTab = this.initialTab;
      if (this.activeTab === 'approvals' || this.activeTab === 'status') {
        this.loadRequests();
      }
      if (this.showInlineCreateForm) {
        this.initInlineCreateForm();
      }
    }
  }
  
  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
  
  private initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    
    this.formData = {
      requesterName: this.currentUser?.name || 'Deepak Kumar',
      department: this.currentUser?.department || 'IT',
      emailId: this.currentUser?.email || 'dk897869@gmail.com',
      requestDate: today,
      contactNo: this.currentUser?.contactNo || '6239785524',
      organization: this.currentUser?.organization || 'Radiant Appliances',
      titleOfActivity: '',
      vendor: '',
      amount: 0,
      priority: 'High',
      description: '',
      objective: '',
      ccList: []
    };
    
    this.ccList = [];
    this.ccInput = '';
  }
  
  loadRequests() {
    this.isLoading = true;
    forkJoin({
      ep: this.authService.getAllEPApprovalRequests().pipe(timeout(60000), catchError(() => of([]))),
      rfq: this.authService.getRFQs().pipe(timeout(60000), catchError(() => of([]))),
      pr: this.authService.getPrNppRequests().pipe(timeout(60000), catchError(() => of([]))),
      po: this.authService.getPoNppRequests().pipe(timeout(60000), catchError(() => of([])))
    }).subscribe({
      next: (res: any) => {
        let epList: EPRequest[] = [];
        let rfqList: EPRequest[] = [];
        let prList: EPRequest[] = [];
        let poList: EPRequest[] = [];

        const epData = res.ep?.data || (Array.isArray(res.ep) ? res.ep : res.ep?.requests || []);
        if (Array.isArray(epData)) {
          epList = epData
            .filter((r: any) => {
              const title = String(r.title || r.subject || r.titleOfActivity || '').trim();
              return title && title.toLowerCase() !== 'nm';
            })
            .map((r: any) => ({ ...this.mapRecord(r), type: 'EP' as const }));
        }

        const rfqData = res.rfq?.data || (Array.isArray(res.rfq) ? res.rfq : []);
        if (Array.isArray(rfqData)) {
          rfqList = rfqData.map((r: any) => ({
            _id: r._id || r.id,
            id: r._id || r.id,
            requestId: r.rfqNo || r.uniqueSerialNo || `RFQ-${r._id?.slice(-6)}`,
            title: r.title || r.rfqTitle || r.projectTitle || 'RFQ Requisition',
            requester: r.requesterName || r.requester || r.createdBy?.name || 'Purchase Dept',
            email: r.email || r.requesterEmail || '',
            department: r.department || 'Purchase',
            vendor: r.vendorName || (r.selectedVendors ? r.selectedVendors.join(', ') : 'Multiple Vendors'),
            amount: Number(r.estimatedCost || r.amount || 0),
            priority: this.mapPriorityFromBackend(r.priority),
            status: this.normalizeStatus(r.status),
            description: r.description || r.purpose || '',
            objective: r.objective || '',
            requestDate: r.createdDate || r.requestDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : ''),
            type: 'RFQ' as const,
            stakeholders: r.stakeholders || r.approvalChain || [],
            attachments: r.attachments || []
          }));
        }

        const prData = res.pr?.data || (Array.isArray(res.pr) ? res.pr : []);
        if (Array.isArray(prData)) {
          prList = prData.map((r: any) => ({
            _id: r._id || r.id,
            id: r._id || r.id,
            requestId: r.prNo || r.uniqueSerialNo || `PR-${r._id?.slice(-6)}`,
            title: r.title || r.purpose || 'Purchase Requisition (PR)',
            requester: r.requesterName || r.requester || 'Requester',
            email: r.email || '',
            department: r.department || 'Procurement',
            vendor: r.vendorName || 'N/A',
            amount: Number(r.totalAmount || r.amount || 0),
            priority: this.mapPriorityFromBackend(r.priority),
            status: this.normalizeStatus(r.status),
            description: r.remarks || r.purpose || '',
            type: 'PR' as const,
            stakeholders: r.approvers || r.stakeholders || [],
            attachments: r.attachments || []
          }));
        }

        const poData = res.po?.data || (Array.isArray(res.po) ? res.po : []);
        if (Array.isArray(poData)) {
          poList = poData.map((r: any) => ({
            _id: r._id || r.id,
            id: r._id || r.id,
            requestId: r.poNo || r.uniqueSerialNo || `PO-${r._id?.slice(-6)}`,
            title: r.title || `Purchase Order ${r.poNo || ''}`,
            requester: r.requesterName || r.buyerName || 'Purchase Dept',
            email: r.email || '',
            department: r.department || 'Purchase',
            vendor: r.vendorName || 'Supplier',
            amount: Number(r.totalAmount || r.amount || 0),
            priority: this.mapPriorityFromBackend(r.priority),
            status: this.normalizeStatus(r.status),
            description: r.terms || r.remarks || '',
            type: 'PO' as const,
            stakeholders: r.approvers || r.stakeholders || [],
            attachments: r.attachments || []
          }));
        }

        this.allRequests = [...epList, ...rfqList, ...prList, ...poList];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadSampleData() {
    this.allRequests = [
      {
        requestId: 'EP-20260624-001',
        title: 'Software License Purchase',
        requester: 'Deepak Kumar',
        email: 'deepak@company.com',
        department: 'IT',
        priority: 'High',
        status: 'Pending',
        amount: 150000,
        requestDate: '2026-06-24',
        vendor: 'Microsoft',
        description: 'Annual software license renewal',
        objective: 'Ensure compliance and continued access'
      },
      {
        requestId: 'EP-20260623-002',
        title: 'Office Equipment Procurement',
        requester: 'Rahul Sharma',
        email: 'rahul@company.com',
        department: 'Purchase',
        priority: 'Medium',
        status: 'Pending',
        amount: 75000,
        requestDate: '2026-06-23',
        vendor: 'XYZ Office Supplies',
        description: 'New office furniture and equipment',
        objective: 'Upgrade office infrastructure'
      },
      {
        requestId: 'EP-20260622-003',
        title: 'Marketing Campaign Budget',
        requester: 'Priya Patel',
        email: 'priya@company.com',
        department: 'Marketing',
        priority: 'High',
        status: 'Approved',
        amount: 200000,
        requestDate: '2026-06-22',
        vendor: 'Digital Media Agency',
        description: 'Digital marketing campaign',
        objective: 'Increase brand awareness'
      }
    ];
    this.applyFilters();
    this.cdr.detectChanges();
  }
  
  private mapRecord(r: any): EPRequest {
    console.log('🔍 Mapping record:', r);
    
    let canApprove = false;
    let hasAlreadyActioned = false;
    let userActionStatus = '';
    let currentApprover = '';
    
    const stakeholders = r.stakeholders || r.approvalChain || [];
    if (Array.isArray(stakeholders) && stakeholders.length > 0 && this.currentUser) {
      const userAction = stakeholders.find((s: any) =>
        (s.email && this.currentUser?.email && s.email.toLowerCase() === this.currentUser.email.toLowerCase()) ||
        (s.name && this.currentUser?.name && s.name.toLowerCase() === this.currentUser.name.toLowerCase())
      );

      if (userAction && (userAction.status === 'Approved' || userAction.status === 'approved' || userAction.status === 'Rejected' || userAction.status === 'rejected')) {
        hasAlreadyActioned = true;
        userActionStatus = userAction.status.charAt(0).toUpperCase() + userAction.status.slice(1).toLowerCase();
        canApprove = false;
      } else if (r.status === 'Approved' || r.status === 'Rejected') {
        canApprove = false;
      } else {
        const pending = stakeholders.filter((s: any) => s.status === 'Pending' || s.status === 'pending');
        if (pending.length > 0) {
          const firstPendingLine = pending[0].line || 'Parallel';
          const currentAllowed = pending.filter((s: any) => (s.line || 'Parallel') === firstPendingLine);
          canApprove = currentAllowed.some((s: any) =>
            (s.email && this.currentUser?.email && s.email.toLowerCase() === this.currentUser.email.toLowerCase()) ||
            (s.name && this.currentUser?.name && s.name.toLowerCase() === this.currentUser.name.toLowerCase())
          ) || ['Admin', 'Purchase Head', 'Head - Purchase', 'VP', 'VP-Operation', 'Engineer', 'Manager'].some(role => 
            (this.currentUser?.designation || this.currentUser?.role || '').toLowerCase().includes(role.toLowerCase())
          );
          currentApprover = pending.map((p: any) => p.name).join(', ');
        } else if (r.status === 'Pending' || r.status === 'In-Process' || r.status === 'In Progress') {
          canApprove = true;
        }
      }
    } else if (r.status === 'Pending' || r.status === 'In-Process' || r.status === 'In Progress') {
      canApprove = true;
    }

    let computedStatus = this.normalizeStatus(r.status);
    if (Array.isArray(stakeholders) && stakeholders.length > 0) {
      const anyRejected = stakeholders.some((s: any) => (s.status || '').toLowerCase() === 'rejected');
      const allApproved = stakeholders.every((s: any) => (s.status || '').toLowerCase() === 'approved');
      const anyApproved = stakeholders.some((s: any) => (s.status || '').toLowerCase() === 'approved');

      if (anyRejected) {
        computedStatus = 'Rejected';
      } else if (allApproved) {
        computedStatus = 'Approved';
      } else {
        // Unless everyone approves, status is In Process or Pending
        computedStatus = anyApproved ? 'In Process' : 'Pending';
      }
    }
    
    return {
      _id: r._id || r.id,
      id: r._id || r.id,
      requestId: r.requestId || r._id || r.id || `EP-${Date.now()}`,
      title: r.title || r.subject || r.titleOfActivity || 'Untitled Request',
      requester: r.requester || r.requesterName || r.createdBy?.name || this.currentUser?.name || 'Unknown',
      email: r.email || r.requesterEmail || r.requester?.email || '',
      department: r.department || r.dept || 'General',
      vendor: r.vendor || r.vendorName || '',
      amount: Number(r.amount ?? r.estimatedAmount ?? r.totalAmount ?? 0),
      priority: this.mapPriorityFromBackend(r.priority),
      status: computedStatus,
      description: r.description || r.remarks || '',
      objective: r.objective || r.purposeAndObjective || '',
      requestDate: r.requestDate || r.date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      currentApprover: currentApprover,
      contactNo: r.contactNo || r.phone || '',
      organization: r.organization || r.company || 'Radiant Appliances',
      ccList: r.ccList || [],
      stakeholders: stakeholders,
      attachments: r.attachments || [],
      createdAt: r.createdAt,
      canApprove: canApprove,
      hasAlreadyActioned: hasAlreadyActioned,
      userActionStatus: userActionStatus
    } as any;
  }
  
  private mapPriorityFromBackend(priority: string): EPRequest['priority'] {
    if (!priority) return 'Medium';
    const p = priority.toString().toUpperCase().trim();
    if (p === 'H' || p === 'HIGH') return 'High';
    if (p === 'URGENT' || p === 'U') return 'Urgent';
    if (p === 'L' || p === 'LOW') return 'Low';
    // default Medium for M, MEDIUM, or anything unrecognized
    return 'Medium';
  }
  
  private normalizeStatus(status: string): EPRequest['status'] {
    if (!status) return 'Pending';
    const s = status.toString().toLowerCase();
    if (s === 'approved' || s === 'approve') return 'Approved';
    if (s === 'rejected' || s === 'reject') return 'Rejected';
    if (s === 'in-process' || s === 'in process' || s === 'inprocess' || s === 'in_progress') return 'In Process';
    if (s === 'pending' || s === 'new' || s === 'submitted') return 'Pending';
    return 'Pending';
  }

  getLineRowspan(stakeholders: any[], index: number): number {
    if (!stakeholders || index < 0 || index >= stakeholders.length) return 0;
    const currentLine = (stakeholders[index].line || 'Parallel').trim();
    if (index > 0 && (stakeholders[index - 1].line || 'Parallel').trim() === currentLine) {
      return 0;
    }
    let count = 1;
    for (let i = index + 1; i < stakeholders.length; i++) {
      if ((stakeholders[i].line || 'Parallel').trim() === currentLine) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  getApprovalChainSerials(stakeholders: any[]): number[] {
    if (!stakeholders || stakeholders.length === 0) return [];
    const serials: number[] = [];
    let currentGroupNum = 1;
    for (let i = 0; i < stakeholders.length; i++) {
      const current = stakeholders[i];
      const prev = i > 0 ? stakeholders[i - 1] : null;
      if (i === 0) {
        serials.push(currentGroupNum);
      } else {
        const currentLine = (current.line || 'Parallel').toLowerCase();
        const prevLine = (prev.line || 'Parallel').toLowerCase();
        if (currentLine === 'parallel' && prevLine === 'parallel') {
          serials.push(currentGroupNum);
        } else {
          currentGroupNum++;
          serials.push(currentGroupNum);
        }
      }
    }
    return serials;
  }

  getGroupRowClass(stakeholders: any[], index: number): string {
    if (!stakeholders || index < 0 || index >= stakeholders.length) return '';
    const serials = this.getApprovalChainSerials(stakeholders);
    const currentSerial = serials[index];
    const prevSerial = index > 0 ? serials[index - 1] : null;
    const nextSerial = index < stakeholders.length - 1 ? serials[index + 1] : null;
    const isFirstInGroup = currentSerial !== prevSerial;
    const isLastInGroup = currentSerial !== nextSerial;
    let classes = [];
    if (isFirstInGroup) classes.push('group-start');
    if (isLastInGroup) classes.push('group-end');
    if (!isFirstInGroup && !isLastInGroup) classes.push('group-middle');
    return classes.join(' ');
  }
  
  applyFilters() {
    // For requests tab: User requirement: approved & rejected move out of here into status tab!
    let list = [...this.allRequests];
    if (this.activeFilter === 'All') {
      // Show pending and in-process requests
      list = list.filter(r => r.status === 'Pending' || r.status === 'In Process');
    } else {
      list = list.filter(r => r.status === this.activeFilter);
    }
    if (this.filterPriority) {
      list = list.filter(r => r.priority === this.filterPriority);
    }
    if (this.filterStatus) {
      list = list.filter(r => r.status === this.filterStatus);
    }
    if (this.filterDepartment) {
      list = list.filter(r => r.department === this.filterDepartment);
    }
    if (this.filterDate) {
      list = list.filter(r => r.requestDate?.startsWith(this.filterDate));
    }
    if (this.filterVendor) {
      list = list.filter(r => r.vendor?.toLowerCase().includes(this.filterVendor.toLowerCase()));
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.requester?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.vendor?.toLowerCase().includes(q) ||
        r.requestId?.toLowerCase().includes(q)
      );
    }
    this.filteredRequests = list;
    
    // For approvals tab — show ALL requests so approvers can act on them
    let approvalList = [...this.allRequests];
    if (this.filterType && this.filterType !== 'All') {
      approvalList = approvalList.filter(r => (r.type || 'EP') === this.filterType);
    }
    if (this.filterPriority) {
      approvalList = approvalList.filter(r => r.priority === this.filterPriority);
    }
    if (this.filterStatus) {
      approvalList = approvalList.filter(r => r.status === this.filterStatus);
    }
    if (this.filterDepartment) {
      approvalList = approvalList.filter(r => r.department === this.filterDepartment);
    }
    if (this.filterDate) {
      approvalList = approvalList.filter(r => r.requestDate?.startsWith(this.filterDate));
    }
    this.approvalList = approvalList;
    
    // For status tab
    this.statusList = this.allRequests;
    this.applyStatusFilters();
    
    this.cdr.detectChanges();
  }

  applyStatusFilters(): void {
    let list = [...this.allRequests];
    if (this.statusTabFilter && this.statusTabFilter !== 'All') {
      list = list.filter(r => r.status === this.statusTabFilter);
    } else {
      // By default in Status tab, show Approved and Rejected records
      list = list.filter(r => r.status === 'Approved' || r.status === 'Rejected');
    }
    if (this.filterPriority) {
      list = list.filter(r => r.priority === this.filterPriority);
    }
    if (this.filterDepartment) {
      list = list.filter(r => r.department === this.filterDepartment);
    }
    if (this.filterDate) {
      list = list.filter(r => r.requestDate?.startsWith(this.filterDate));
    }
    if (this.filterVendor) {
      list = list.filter(r => r.vendor?.toLowerCase().includes(this.filterVendor.toLowerCase()));
    }
    if (this.statusSearchQuery.trim()) {
      const q = this.statusSearchQuery.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.requester?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.vendor?.toLowerCase().includes(q) ||
        r.requestId?.toLowerCase().includes(q)
      );
    }
    this.filteredStatusList = list;
  }

  getRequestAgeDays(req: EPRequest): number {
    const d = req.requestDate || req.createdAt;
    if (!d) return 0;
    const diff = Date.now() - new Date(d).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  getPriorityShort(p: string): string {
    const map: Record<string, string> = { High: 'H', Medium: 'M', Low: 'L', Urgent: 'U' };
    return map[p] || (p?.charAt(0)?.toUpperCase() || 'M');
  }
  
  setTab(tab: 'requests' | 'approvals' | 'status') {
    this.activeTab = tab;
    if (tab === 'requests' && this.showInlineCreateForm) {
      this.initInlineCreateForm();
    }
    this.applyFilters();
  }
  
  setFilter(filter: 'All' | 'Approved' | 'Rejected' | 'Pending' | 'In Process') {
    this.activeFilter = filter;
    this.applyFilters();
  }
  
  clearFilters() {
    this.filterPriority = '';
    this.filterStatus = '';
    this.filterDepartment = '';
    this.filterDate = '';
    this.filterVendor = '';
    this.applyFilters();
  }
  
  onSearch() {
    this.applyFilters();
  }
  
  countByStatus(status: string): number {
    if (status === 'All') return this.allRequests.length;
    return this.allRequests.filter(r => r.status === status).length;
  }
  
  getStatusPercentage(status: string): number {
    const total = this.allRequests.length;
    if (total === 0) return 0;
    const count = this.countByStatus(status);
    return Math.round((count / total) * 100);
  }

  getDonutGradient(): string {
    const total = this.allRequests.length;
    if (total === 0) {
      return 'conic-gradient(#e2e8f0 0% 100%)';
    }
    const appPct = this.getStatusPercentage('Approved');
    const penPct = this.getStatusPercentage('Pending') + this.getStatusPercentage('In Process');
    const rejPct = this.getStatusPercentage('Rejected');
    
    return `conic-gradient(
      #10b981 0% ${appPct}%,
      #f59e0b ${appPct}% ${appPct + penPct}%,
      #ef4444 ${appPct + penPct}% 100%
    )`;
  }
  
  getUniqueDepartments(): string[] {
    return [...new Set(this.allRequests.map(r => r.department).filter(Boolean))];
  }
  
  // ====================== CREATE MODAL METHODS ======================
  
  openCreateModal() {
    this.initInlineCreateForm();
    if (!this.showInlineCreateForm) {
      this.showCreateModal = true;
    }
  }
  
  closeCreateModal() {
    this.showCreateModal = false;
  }

  onInlineFormSaved(event: any): void {
    this.loadRequests();
    this.showToast('EP request submitted successfully', 'success');
  }
  
  // Approval Chain Methods
  addApprover() {
    const newId = Math.max(...this.approvers.map(a => a.id || 0), 0) + 1;
    this.approvers.push({
      id: newId,
      line: 'Parallel',
      managerName: '',
      email: '',
      designation: '',
      status: 'pending',
      dateTime: '',
      remarks: '',
      contactNo: '',
      organization: ''
    });
  }
  
  removeApprover(index: number) {
    if (this.approvers.length > 1) {
      this.approvers.splice(index, 1);
    }
  }
  
  onManagerChange(approver: Approver, managerName: string) {
    const manager = this.managerOptions.find(m => m.name === managerName);
    if (manager) {
      approver.managerName = manager.name;
      approver.email = manager.email;
      approver.designation = manager.designation;
    } else {
      approver.managerName = managerName;
    }
    if (approver.managerName) {
      approver.dateTime = new Date().toLocaleString();
    }
  }
  
  // Approver Detail Modal State
  showApproverModal = false;
  selectedApproverDetail: any = null;

  openApproverDetail(approver: any) {
    if (!approver) return;
    this.selectedApproverDetail = approver;
    this.showApproverModal = true;
    this.cdr.detectChanges();
  }

  closeApproverDetail() {
    this.showApproverModal = false;
    this.selectedApproverDetail = null;
  }

  // Attachment Methods
  onFileSelected(attachment: Attachment, event: any) {
    const file = event.target.files[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showToast('File size exceeds 5MB limit', 'error');
        return;
      }

      attachment.file = file;
      (attachment as any).fileName = file.name;
      attachment.fileSize = this.formatFileSize(file.size);
      (attachment as any).fileType = file.type;

      // Auto-fill attachment name preserving full filename with extension
      if (!attachment.name || /^Attachment\s*\d*$/i.test(attachment.name.trim())) {
        attachment.name = file.name;
      }

      // Synchronously create Blob URL for instant preview availability
      try {
        const blobUrl = URL.createObjectURL(file);
        (attachment as any).url = blobUrl;
        (attachment as any).fileUrl = blobUrl;
      } catch (e) {}

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result;
        attachment.preview = dataUrl;
        (attachment as any).url = dataUrl;
        (attachment as any).data = dataUrl;
        (attachment as any).fileUrl = dataUrl;
        try {
          if (file.name) sessionStorage.setItem(`ep_att_${file.name}`, dataUrl);
          if (attachment.name) sessionStorage.setItem(`ep_att_${attachment.name}`, dataUrl);
        } catch (err) {}
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }
  
  removeAttachment(attachment: Attachment) {
    attachment.file = null;
    attachment.fileSize = '';
    attachment.preview = '';
    const fileInput = document.querySelector(`input[data-attachment-id="${attachment.id}"]`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }
  
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // CC Methods
  addCc() {
    const email = this.ccInput.trim();
    if (email && this.validateEmail(email) && !this.ccList.includes(email)) {
      this.ccList.push(email);
      this.ccInput = '';
      this.formData.ccList = this.ccList;
    } else if (email && !this.validateEmail(email)) {
      this.showToast('Invalid email format', 'error');
    }
  }
  
  removeCc(index: number) {
    this.ccList.splice(index, 1);
    this.formData.ccList = this.ccList;
  }
  
  private validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  // Preview PDF
  previewPDF() {
    if (!this.validateForm()) return;
    
    this.previewData = {
      ...this.formData,
      approvers: this.approvers.filter(a => a.managerName),
      attachments: this.attachments.filter(a => a.file),
      ccList: this.ccList
    };
    
    this.generatePreviewHTML();
  }
  
  private generatePreviewHTML() {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) return;
    
    const activeApprovers = this.approvers.filter(a => a.managerName);
    const approversHtml = activeApprovers.map((a, idx) => {
      const rowspan = this.getLineRowspan(activeApprovers, idx);
      
      let lineCol = rowspan > 0 ? `<td rowspan="${rowspan}" style="text-align:center; vertical-align:middle; font-weight:700; background:#f8fafc; border:1px solid #cbd5e1; padding:8px;">${a.line || 'Parallel'}</td>` : '';

      return `
        <tr>
          ${lineCol}
          <td colspan="2" style="padding:8px; border:1px solid #cbd5e1; font-weight:600; color:#0f172a;">${a.managerName}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; color:#475569;">${a.remarks || '—'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; color:#334155;">${a.designation || '—'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; color:${(a.status as any) === 'Approved' || (a.status as any) === 'approved' ? '#059669' : '#d97706'}; font-weight:700;">${a.status || 'In-Process'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; color:#64748b; font-size:12px;">${a.dateTime || '—'}</td>
        </tr>
      `;
    }).join('');
    
    const validAttachments = this.attachments.filter(a => a.file);
    const attachmentsHtml = validAttachments.map((a, idx) => {
      return `
        <tr>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${idx + 1}</td>
          <td colspan="3" style="padding:8px; border:1px solid #cbd5e1;">${a.name}</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${a.fileSize}</td>
          <td colspan="2" style="padding:8px; border:1px solid #cbd5e1;">${a.remark || '—'}</td>
        </tr>
      `;
    }).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>EP Request Preview - ${this.selectedRequestCopy.title || this.selectedRequestCopy.titleOfActivity}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
          body { background: white; padding: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; color: #0f172a; margin-top: 20px; }
          th, td { border: 1px solid #94a3b8; padding: 8px 12px; }
          th { background: #f1f5f9; font-weight: 700; text-align: left; }
          .section-label { background: #e2e8f0; text-align: center; font-weight: 700; vertical-align: middle; width: 140px; }
          .label { background: #f8fafc; font-weight: 600; width: 120px; text-align: center; }
          .val { text-align: center; }
          @media print {
            body { padding: 0; }
            .btn-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0;">EP Approval Request</h2>
          <button class="btn-print" onclick="window.print()" style="background:#2563eb; color:white; border:none; padding:10px 24px; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px; box-shadow:0 4px 6px rgba(37,99,235,0.2);">🖨️ Print Request</button>
        </div>

        <table>
          <tbody>
            <!-- Requester Information -->
            <tr>
              <th rowspan="3" class="section-label">Requester<br>Information</th>
              <th class="label">Name</th>
              <td colspan="2" class="val" style="font-weight:700;">${this.selectedRequestCopy.requester || this.selectedRequestCopy.requesterName || ''}</td>
              <th class="label">Request Date</th>
              <td colspan="2" class="val">${this.selectedRequestCopy.date || this.selectedRequestCopy.requestDate || ''}</td>
            </tr>
            <tr>
              <th class="label">Department</th>
              <td colspan="2" class="val">${this.selectedRequestCopy.department || ''}</td>
              <th class="label">Contact No.</th>
              <td colspan="2" class="val">${this.selectedRequestCopy.contactNo || '—'}</td>
            </tr>
            <tr>
              <th class="label">Email ID</th>
              <td colspan="2" class="val"><a href="mailto:${this.selectedRequestCopy.emailId || this.selectedRequestCopy.email}" style="color:#2563eb;">${this.selectedRequestCopy.emailId || this.selectedRequestCopy.email || ''}</a></td>
              <th class="label">Organization</th>
              <td colspan="2" class="val">${this.selectedRequestCopy.organization || ''}</td>
            </tr>

            <!-- Activity Overview -->
            <tr>
              <th class="section-label">Activity Overview</th>
              <th class="label">Title of Activity</th>
              <td colspan="3" style="font-weight:600;">${this.selectedRequestCopy.title || this.selectedRequestCopy.titleOfActivity || ''}</td>
              <th class="label">Priority</th>
              <td class="val">${this.selectedRequestCopy.priority || ''}</td>
            </tr>

            <!-- Description -->
            <tr>
              <th class="section-label">Description</th>
              <td colspan="6" style="padding: 16px; white-space: pre-wrap; vertical-align: top; line-height: 1.5; min-height: 120px;">${this.selectedRequestCopy.description || this.selectedRequestCopy.objective || this.selectedRequestCopy.purpose || ''}</td>
            </tr>

            <!-- Approval Chain Header -->
            ${activeApprovers.length > 0 ? `
            <tr>
              <th rowspan="${activeApprovers.length + 1}" class="section-label">Approval</th>
              <th class="label">Line</th>
              <th colspan="2" class="label">Stakeholder</th>
              <th class="label">Comments/Remarks</th>
              <th class="label">Designation</th>
              <th class="label">Status</th>
              <th class="label">Date/Time</th>
            </tr>
            ${approversHtml}
            ` : ''}

            <!-- Attachments Header -->
            ${validAttachments.length > 0 ? `
            <tr>
              <th rowspan="${validAttachments.length + 1}" class="section-label">Attachments</th>
              <th class="label">S. No.</th>
              <th colspan="3" class="label">Attachment</th>
              <th class="label">File Size</th>
              <th colspan="2" class="label">Remark</th>
            </tr>
            ${attachmentsHtml}
            ` : ''}

            <!-- CC To -->
            ${this.ccList.length > 0 ? `
            <tr>
              <th class="section-label">CC to</th>
              <td colspan="6" class="val" style="padding: 12px;">
                <div style="font-weight: 700; margin-bottom: 6px;">Mail ID</div>
                ${this.ccList.map(email => `<a href="mailto:${email}" style="color:#2563eb; display:block; margin-bottom:4px;">${email};</a>`).join('')}
              </td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    previewWindow.document.write(html);
    previewWindow.document.close();
  }
  
  // Download Excel
  downloadExcel() {
    const data = [
      ['EP Request Details'],
      ['Field', 'Value'],
      ['Requester Name', this.formData.requesterName],
      ['Department', this.formData.department],
      ['Email ID', this.formData.emailId],
      ['Contact No.', this.formData.contactNo],
      ['Organization', this.formData.organization],
      ['Request Date', this.formData.requestDate],
      ['Title of Activity', this.formData.titleOfActivity],
      ['Vendor', this.formData.vendor],
      ['Amount', this.formData.amount],
      ['Priority', this.formData.priority],
      ['Description', this.formData.description],
      ['Objective', this.formData.objective],
      [],
      ['Approval Chain'],
      ['#', 'Line', 'Manager Name', 'Designation', 'Email', 'Status', 'Remarks']
    ];
    
    this.approvers.filter(a => a.managerName).forEach((a, idx) => {
      data.push([(idx + 1).toString(), a.line, a.managerName, a.designation, a.email, a.status, a.remarks]);
    });
    
    data.push([], ['CC Recipients']);
    this.ccList.forEach(cc => data.push([cc]));
    
    data.push([], ['Attachments']);
    data.push(['S.No.', 'Attachment Name', 'File Size', 'Remark']);
    this.attachments.filter(a => a.file).forEach((a, idx) => {
      data.push([(idx + 1).toString(), a.name, a.fileSize, a.remark]);
    });
    
    const wsData = data.map(row => row.join('\t')).join('\n');
    const blob = new Blob([wsData], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EP_Request_${this.formData.titleOfActivity || 'Draft'}_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Excel file downloaded', 'success');
  }
  
  // Validation
  private validateForm(): boolean {
    if (!this.formData.titleOfActivity?.trim()) {
      this.showToast('Title of Activity is required', 'error');
      return false;
    }
    
    const validApprovers = this.approvers.filter(a => a.managerName);
    if (validApprovers.length === 0) {
      this.showToast('At least one approver is required', 'error');
      return false;
    }
    
    return true;
  }
  
  submitCreateRequest() {
    if (!this.validateForm()) return;
    
    this.isSubmitting = true;
    
    const validCcList = this.ccList.filter(email => email && email.trim());
    const user = this.authService.getUser() || this.currentUser;
    
    const payload = {
      title: this.formData.titleOfActivity,
      requester: this.formData.requesterName,
      department: this.formData.department,
      email: this.formData.emailId,
      requestDate: this.formData.requestDate,
      contactNo: this.formData.contactNo,
      organization: this.formData.organization,
      vendor: this.formData.vendor,
      amount: Number(this.formData.amount),
      priority: this.formData.priority,
      description: this.formData.description,
      objective: this.formData.objective,
      
      stakeholders: this.approvers.filter(a => a.managerName).map((a, idx) => ({
        line: a.line,
        name: a.managerName,
        email: a.email,
        designation: a.designation,
        approvalOrder: idx + 1,
        status: 'Pending',
        remarks: a.remarks,
        dateTime: a.dateTime || new Date().toISOString()
      })),
      
      attachments: this.attachments
        .filter(a => a.file || a.preview || (a as any).url)
        .map(a => {
          const prv = a.preview || (a as any).url || (a as any).data || '';
          return {
            name: a.name,
            fileName: (a.file ? a.file.name : '') || (a as any).fileName || a.name,
            fileSize: a.fileSize,
            remark: a.remark,
            preview: (prv && prv.length < 2500000) ? prv : '',
            fileType: a.file ? a.file.type : ((a as any).fileType || '')
          };
        }),
      
      ccList: validCcList,
      requesterEmail: this.formData.emailId,
      status: 'Pending'
    };
    
    console.log('📤 Submitting payload:', JSON.stringify(payload, null, 2));
    
    this.authService.createEPRequest(payload).subscribe({
      next: (res: any) => {
        console.log('✅ Create response:', res);
        this.showCreateModal = false;
        this.isSubmitting = false;
        this.showToast('EP Request created successfully!', 'success');
        this.loadRequests();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Create error:', err);
        this.isSubmitting = false;
        
        let errorMsg = 'Failed to create request';
        if (err?.error?.message) {
          errorMsg = err.error.message;
        } else if (err?.message) {
          errorMsg = err.message;
        }
        this.showToast(errorMsg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  selectedRequestCopy: any = null;
  isEditingRequest = false;

  // View Request
  viewRequest(request: EPRequest) {
    this.selectedRequest = request;
    this.selectedRequestCopy = JSON.parse(JSON.stringify(request));
    this.isEditingRequest = false;
    this.showViewModal = true;
  }
  
  isAdminUser(): boolean {
    return this.authService.getUserRole() === 'Admin';
  }

  isPurchaseHeadOrAdmin(): boolean {
    const user = this.authService.getUser();
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    const dept = String(user.department || '').toLowerCase();
    const desig = String(user.designation || '').toLowerCase();
    return role === 'admin' || role === 'purchase' || dept.includes('purchase') || desig.includes('purchase') || desig.includes('head');
  }

  approveFromViewModal(request: any) {
    const id = request._id || request.id;
    if (!id) return;
    const remarks = this.selectedRequestCopy?.approvalComments || '';
    this.isSubmitting = true;
    this.authService.approveEPRequest(id, remarks).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('EP Request approved successfully', 'success');
        if (this.selectedRequestCopy) {
          this.selectedRequestCopy.canApprove = false;
          this.selectedRequestCopy.hasAlreadyActioned = true;
          this.selectedRequestCopy.userActionStatus = 'Approved';
          if (res?.data?.approvalChain || res?.request?.approvalChain) {
            this.selectedRequestCopy.approvalChain = res?.data?.approvalChain || res?.request?.approvalChain;
          }
        }
        this.cdr.detectChanges();
        this.loadRequests();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to approve request', 'error');
      }
    });
  }

  rejectFromViewModal(request: any) {
    const id = request._id || request.id;
    if (!id) return;
    const remarks = this.selectedRequestCopy?.approvalComments || '';
    this.isSubmitting = true;
    this.authService.rejectEPRequest(id, remarks).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('EP Request rejected successfully', 'success');
        if (this.selectedRequestCopy) {
          this.selectedRequestCopy.canApprove = false;
          this.selectedRequestCopy.hasAlreadyActioned = true;
          this.selectedRequestCopy.userActionStatus = 'Rejected';
          if (res?.data?.approvalChain || res?.request?.approvalChain) {
            this.selectedRequestCopy.approvalChain = res?.data?.approvalChain || res?.request?.approvalChain;
          }
        }
        this.cdr.detectChanges();
        this.loadRequests();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to reject request', 'error');
      }
    });
  }

  queryFromViewModal(request: any) {
    const id = request._id || request.id;
    if (!id) return;
    const remarks = this.selectedRequestCopy.approvalComments || '';
    const queryAssignedTo = this.selectedRequestCopy.queryAssignedTo || '';
    
    if (!queryAssignedTo) {
      this.showToast('Please select or enter an email to assign the query', 'error');
      return;
    }
    
    this.isSubmitting = true;
    this.authService.queryEPRequest(id, remarks, queryAssignedTo).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('Query assigned successfully', 'success');
        this.closeViewModal();
        this.loadRequests();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to assign query', 'error');
      }
    });
  }

  addApproverInView() {
    if (!this.selectedRequestCopy) return;
    if (!this.selectedRequestCopy.stakeholders) this.selectedRequestCopy.stakeholders = [];
    this.selectedRequestCopy.stakeholders.push({
      name: '',
      email: '',
      designation: 'Admin',
      organization: 'Radiant Appliances',
      status: 'Pending',
      line: 'Parallel',
      isNew: true
    });
    this.showToast('Approver row added.', 'success');
  }

  deleteApproverInView(idx: number) {
    if (!this.selectedRequestCopy || !this.selectedRequestCopy.stakeholders) return;
    this.selectedRequestCopy.stakeholders.splice(idx, 1);
    this.showToast('Approver row removed.', 'info');
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedRequest = null;
    this.selectedRequestCopy = null;
    this.isEditingRequest = false;
  }

  saveEditedRequest() {
    if (!this.selectedRequestCopy || !this.selectedRequestCopy.title?.trim()) {
      this.showToast('Title is required', 'error');
      return;
    }
    if (!this.selectedRequestCopy.vendor?.trim()) {
      this.showToast('Vendor is required', 'error');
      return;
    }
    if (this.selectedRequestCopy.amount == null || this.selectedRequestCopy.amount <= 0) {
      this.showToast('Valid amount is required', 'error');
      return;
    }

    this.isSubmitting = true;
    const id = this.selectedRequestCopy._id || this.selectedRequestCopy.id;
    this.authService.updateEPRequest(id, this.selectedRequestCopy).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('EP Request updated successfully!', 'success');
        this.showViewModal = false;
        this.loadRequests();
        
        // Notify admin
        this.authService.notifyAdminsForEPRequest({
          requestId: this.selectedRequestCopy.requestId,
          title: this.selectedRequestCopy.title,
          requester: this.selectedRequestCopy.requester,
          amount: this.selectedRequestCopy.amount
        }).subscribe();
        
        this.showToast('Admin notified: EP approval submitted for review', 'info');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to update request', 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  // Approval Methods
  openApprovalModal(request: EPRequest, action: 'approve' | 'reject') {
    this.selectedRequest = request;
    this.approvalAction = action;
    this.approvalRemarks = '';
    this.showApprovalModal = true;
  }
  
  closeApprovalModal() {
    this.showApprovalModal = false;
    this.selectedRequest = null;
    this.approvalRemarks = '';
  }
  
  submitApproval() {
    if (!this.approvalRemarks.trim()) {
      this.showToast('Please provide remarks', 'error');
      return;
    }
    
    this.isSubmitting = true;
    const id = this.selectedRequest?._id || this.selectedRequest?.id;
    
    if (!id) {
      this.showToast('Invalid request ID', 'error');
      return;
    }
    
    const action$ = this.approvalAction === 'approve'
      ? this.authService.approveEPRequest(id, this.approvalRemarks)
      : this.authService.rejectEPRequest(id, this.approvalRemarks);
    
    action$.subscribe({
      next: () => {
        if (this.selectedRequest) {
          this.selectedRequest.status = this.approvalAction === 'approve' ? 'Approved' : 'Rejected';
          const index = this.allRequests.findIndex(r => (r._id || r.id) === id);
          if (index !== -1) {
            this.allRequests[index].status = this.selectedRequest.status;
          }
        }
        this.applyFilters();
        this.closeApprovalModal();
        this.isSubmitting = false;
        this.showToast(`Request ${this.approvalAction}d successfully!`, 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || `Failed to ${this.approvalAction} request`, 'error');
        this.cdr.detectChanges();
      }
    });
  }
  
  // Utility Methods
  getDaysPending(dateStr?: string): number {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }
  
  formatAmount(amount?: number): string {
    return amount ? '₹' + amount.toLocaleString('en-IN') : '₹0';
  }
  
  getPriorityClass(priority: string): string {
    const p = (priority || 'Medium').toLowerCase();
    if (p === 'high' || p === 'urgent') return 'high';
    if (p === 'low') return 'low';
    return 'medium';
  }
  
  getStatusClass(status: string): string {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    if (s === 'in-process' || s === 'in process') return 'in-process';
    return 'pending';
  }
  
  canApprove(request: EPRequest): boolean {
    return request.status === 'Pending' || request.status === 'In Process';
  }
  
  isAdminOrManager(): boolean {
    const role = this.authService.getUserRole();
    return role === 'Admin' || role === 'Manager';
  }
  
  getFilteredManagers(query: string): any[] {
    const term = (query || '').toLowerCase().trim();
    if (!term) return this.managerOptions;
    return this.managerOptions.filter(m => 
      (m.name || '').toLowerCase().includes(term) ||
      (m.designation || '').toLowerCase().includes(term)
    );
  }

  onManagerLookup(approver: any, value: string) {
    const term = (value || '').trim().toLowerCase();
    const manager = this.managerOptions.find((m: any) =>
      (m.name || '').toLowerCase() === term || (m.email || '').toLowerCase() === term
    );
    approver.managerName = value;
    if (manager) {
      approver.managerName = manager.name;
      approver.email = manager.email;
      approver.designation = manager.designation;
      approver.dateTime = new Date().toLocaleString();
    }
  }

  selectManager(approver: any, manager: any) {
    approver.managerName = manager.name;
    approver.email = manager.email;
    approver.designation = manager.designation;
    approver.showSuggestions = false;
    approver.dateTime = new Date().toLocaleString();
  }

  onManagerBlur(approver: any) {
    setTimeout(() => {
      approver.showSuggestions = false;
      this.cdr.detectChanges();
    }, 200);
  }

  private loadManagerOptions() {
    this.authService.getManagers().subscribe({
      next: (res: any) => {
        const list = res?.managers || res?.defaultApprovers || [];
        this.managerOptions = Array.isArray(list) ? list : [];
        if (!this.managerOptions.length) this.setDefaultManagers();
      },
      error: () => { this.setDefaultManagers(); }
    });
  }

  private setDefaultManagers() {
    this.managerOptions = [
      { name: 'Manoj', email: 'parasharvijaydeep@yahoo.com', designation: 'Engineer', department: 'Store', contactNo: '8807900000', organization: 'Radiant', employeeId: '100845' },
      { name: 'Depak', email: 'parasharvijaydeep@gmail.com', designation: 'Engineer', department: 'Purchase', contactNo: '8807900000', organization: 'Radiant', employeeId: '100846' },
      { name: 'Vijay Deep Parashar', email: 'vijay.parashar@radiantappliances.com', designation: 'Head - Purchase', department: 'Purchase', contactNo: '8807900000', organization: 'Radiant', employeeId: '100847' },
      { name: 'Rajeev Jha', email: 'contact@vdpnexus.com', designation: 'VP-Operation', department: 'Plant Head', contactNo: '8807900000', organization: 'VDP Nexus' }
    ];
  }

  showToast(message: string, type: 'success' | 'error' | 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 2000);
  }
  
  closeToast() {
    this.toast = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }
  
  async generateEPPdfBlob(req?: any): Promise<{ blob: Blob; filename: string }> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const r = req || this.selectedRequestCopy || this.selectedRequest;
    if (!r) throw new Error('No request provided');
    const reqId = r.requestId || r._id || r.id || 'EP-REQUEST';
    const filename = `EP_Request_${reqId}.pdf`;

    // Header Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('RADIANT APPLIANCES & ELECTRONICS', 14, 13);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('LCGC RFQ PORTAL - EP APPROVAL RECORD', 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`ID: ${reqId}`, 196, 13, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Date: ${r.requestDate || new Date().toISOString().split('T')[0]}`, 196, 20, { align: 'right' });

    // Status Banner
    const isApproved = (r.status || '').toLowerCase() === 'approved';
    const isRejected = (r.status || '').toLowerCase() === 'rejected';
    doc.setFillColor(isApproved ? 240 : (isRejected ? 254 : 241), isApproved ? 253 : (isRejected ? 242 : 245), isApproved ? 244 : (isRejected ? 242 : 249));
    doc.rect(14, 38, 182, 12, 'F');
    doc.setDrawColor(isApproved ? 187 : (isRejected ? 254 : 203), isApproved ? 247 : (isRejected ? 202 : 213), isApproved ? 208 : (isRejected ? 202 : 225));
    doc.rect(14, 38, 182, 12, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(isApproved ? 22 : (isRejected ? 220 : 37), isApproved ? 101 : (isRejected ? 38 : 99), isApproved ? 52 : (isRejected ? 38 : 235));
    doc.text(`STATUS: ${(r.status || 'Pending').toUpperCase()}`, 20, 46);

    if (r.priority) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Priority: ${r.priority}`, 190, 46, { align: 'right' });
    }

    // Section 1: Request Overview
    let y = 58;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. REQUEST DETAILS', 14, y);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y + 2, 196, y + 2);

    y += 8;
    doc.setFontSize(9);

    const leftCol = [
      ['Title of Activity:', r.title || '—'],
      ['Requester Name:', r.requester || '—'],
      ['Department:', r.department || '—'],
      ['Requester Email:', r.email || '—'],
      ['Contact No:', r.contactNo || '—']
    ];

    const rightCol = [
      ['Vendor:', r.vendor || '—'],
      ['Estimated Amount:', `INR ${Number(r.amount || 0).toLocaleString('en-IN')}`],
      ['Organization:', r.organization || 'Radiant Appliances'],
      ['Request Date:', r.requestDate || '—'],
      ['Current Approver:', r.currentApprover || '—']
    ];

    for (let i = 0; i < Math.max(leftCol.length, rightCol.length); i++) {
      if (leftCol[i]) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(leftCol[i][0], 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(String(leftCol[i][1]), 48, y);
      }
      if (rightCol[i]) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(rightCol[i][0], 115, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(String(rightCol[i][1]), 155, y);
      }
      y += 6;
    }

    // Objective & Description
    if (r.objective || r.description) {
      y += 2;
      if (r.objective) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('Objective:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const objLines = doc.splitTextToSize(r.objective, 150);
        doc.text(objLines, 38, y);
        y += (objLines.length * 5) + 2;
      }
      if (r.description) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('Description:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const descLines = doc.splitTextToSize(r.description, 150);
        doc.text(descLines, 38, y);
        y += (descLines.length * 5) + 2;
      }
    }

    // Section 2: Approval Chain
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. APPROVAL WORKFLOW CHAIN', 14, y);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, y + 2, 196, y + 2);

    y += 8;
    const stakeholders = r.stakeholders || r.approvalChain || [];
    if (stakeholders.length > 0) {
      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Line', 16, y + 5);
      doc.text('Approver / Stakeholder', 38, y + 5);
      doc.text('Designation', 85, y + 5);
      doc.text('Status', 125, y + 5);
      doc.text('Date/Time', 148, y + 5);
      doc.text('Approved By', 172, y + 5);

      y += 8;
      doc.setFontSize(8);
      stakeholders.forEach((st: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const stStatus = st.status || 'Pending';
        const isStApproved = stStatus.toLowerCase() === 'approved';
        const isStRejected = stStatus.toLowerCase() === 'rejected';

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(st.line || 'Parallel', 16, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(st.name || st.managerName || '—', 38, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(st.designation || 'Approver', 85, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isStApproved ? 22 : (isStRejected ? 220 : 37), isStApproved ? 101 : (isStRejected ? 38 : 99), isStApproved ? 52 : (isStRejected ? 38 : 235));
        doc.text(stStatus, 125, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const dtStr = st.dateTime ? new Date(st.dateTime).toLocaleDateString() : '—';
        doc.text(dtStr, 148, y);
        doc.text(st.approvedBy || '—', 172, y);

        y += 6;
      });
    }

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('This is an electronically verified document generated by LCGC RFQ & EP Management System.', 105, 288, { align: 'center' });

    const blob = doc.output('blob');
    return { blob, filename };
  }

  async downloadEPPdf(req?: any): Promise<void> {
    try {
      const { blob, filename } = await this.generateEPPdfBlob(req);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('EP PDF downloaded successfully!', 'success');
    } catch (e: any) {
      console.error('Download PDF error:', e);
      this.showToast('Failed to generate PDF download.', 'error');
    }
  }

  async previewEPPdf(req?: any): Promise<void> {
    try {
      const { blob, filename } = await this.generateEPPdfBlob(req);
      const blobUrl = URL.createObjectURL(blob);
      renderFullScreenDocumentViewer(blobUrl, filename);
    } catch (e: any) {
      console.error('Preview PDF error:', e);
      this.showToast('Failed to preview PDF.', 'error');
    }
  }

  printEPRequest(req?: any): void {
    const r = req || this.selectedRequestCopy || this.selectedRequest;
    if (!r) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const stakeholders = r.stakeholders || r.approvalChain || [];
    const rows = stakeholders.map((st: any) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${st.line || 'Parallel'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${st.name || st.managerName || '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${st.designation || 'Approver'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: ${st.status === 'Approved' ? '#059669' : (st.status === 'Rejected' ? '#dc2626' : '#2563eb')}">${st.status || 'Pending'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${st.dateTime ? new Date(st.dateTime).toLocaleString() : '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${st.approvedBy || '—'}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">${st.remarks || '—'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EP Request - ${r.requestId || r._id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 13px; }
            .meta-row { display: flex; gap: 8px; }
            .meta-lbl { font-weight: bold; color: #64748b; width: 140px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>RADIANT APPLIANCES & ELECTRONICS</h1>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">EP Approval Request Record (${r.requestId || r._id})</p>
            </div>
            <div style="text-align: right;">
              <span class="status-badge" style="background: ${r.status === 'Approved' ? '#dcfce7' : '#fee2e2'}; color: ${r.status === 'Approved' ? '#166534' : '#991b1b'};">Status: ${r.status}</span>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-row"><span class="meta-lbl">Title:</span><span>${r.title}</span></div>
            <div class="meta-row"><span class="meta-lbl">Vendor:</span><span>${r.vendor || '—'}</span></div>
            <div class="meta-row"><span class="meta-lbl">Requester:</span><span>${r.requester} (${r.email || ''})</span></div>
            <div class="meta-row"><span class="meta-lbl">Amount:</span><span>INR ${Number(r.amount || 0).toLocaleString('en-IN')}</span></div>
            <div class="meta-row"><span class="meta-lbl">Department:</span><span>${r.department}</span></div>
            <div class="meta-row"><span class="meta-lbl">Date:</span><span>${r.requestDate}</span></div>
            <div class="meta-row"><span class="meta-lbl">Priority:</span><span>${r.priority}</span></div>
            <div class="meta-row"><span class="meta-lbl">Organization:</span><span>${r.organization || 'Radiant Appliances'}</span></div>
          </div>
          <div style="margin-bottom: 20px;">
            <p><strong>Objective:</strong> ${r.objective || '—'}</p>
            <p><strong>Description:</strong> ${r.description || '—'}</p>
          </div>
          <h3>Approval Workflow Chain</h3>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Stakeholder</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Date/Time</th>
                <th>Approved By</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center;">Electronically generated from LCGC RFQ & EP Management Portal.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  sendApprovedDataEmail(req?: any): void {
    const r = req || this.selectedRequestCopy || this.selectedRequest;
    if (!r) return;
    if (!this.shareEmailAddress || !this.shareEmailAddress.includes('@')) {
      this.showToast('Please enter a valid email address.', 'error');
      return;
    }
    this.isSharingEmail = true;
    this.authService.shareEPRequestByEmail(r.id || r._id, this.shareEmailAddress, this.shareEmailRemarks, r).subscribe({
      next: () => {
        this.isSharingEmail = false;
        this.showToast(`Approved request data successfully sent to ${this.shareEmailAddress}!`, 'success');
        this.shareEmailAddress = '';
        this.shareEmailRemarks = '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSharingEmail = false;
        this.showToast(err?.message || 'Failed to send email.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  exportRequestsCSV(): void {
    const list = this.filteredRequests;
    if (!list || list.length === 0) {
      this.showToast('No requests to export', 'info');
      return;
    }
    const headers = ['Request ID', 'Title', 'Requester', 'Email', 'Department', 'Vendor', 'Amount', 'Priority', 'Status', 'Date', 'Days Pending'];
    const csvRows = [headers.join(',')];
    list.forEach(r => {
      const row = [
        `"${r.requestId || r._id || ''}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.requester || '').replace(/"/g, '""')}"`,
        `"${(r.email || '').replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.vendor || '').replace(/"/g, '""')}"`,
        r.amount || 0,
        `"${r.priority || ''}"`,
        `"${r.status || ''}"`,
        `"${r.requestDate || ''}"`,
        this.getDaysPending(r.requestDate)
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `EP_Requests_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    this.showToast('Requests exported as CSV', 'success');
  }

  trackById(index: number, item: EPRequest) {
    return item._id || item.id || item.requestId || index;
  }
}