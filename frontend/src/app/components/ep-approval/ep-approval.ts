import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
    { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager' },
    { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM' },
    { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' },
    { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP' },
    { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM' },
    { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD' }
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
  sanitizedMediaUrl: SafeResourceUrl | null = null;

  openMediaPreview(attachmentOrUrl: any, title?: string) {
    if (!attachmentOrUrl) {
      this.showToast('Please upload a file first to view preview.', 'info');
      return;
    }
    
    let url = typeof attachmentOrUrl === 'string' ? attachmentOrUrl : (attachmentOrUrl.url || attachmentOrUrl.preview || attachmentOrUrl.data || attachmentOrUrl.fileData || '');
    const name = title || (typeof attachmentOrUrl === 'object' ? attachmentOrUrl.name || attachmentOrUrl.fileName : '') || 'Attachment Preview';
    
    if (!url || (!url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('blob:'))) {
      this.showToast('Please upload a valid PDF or image file first to view preview.', 'info');
      return;
    }

    this.mediaPreviewTitle = name;
    this.mediaZoomScale = 1;

    // Check if image or PDF
    const lowerUrl = url.toLowerCase();
    this.isImageMedia = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(lowerUrl);
    this.isPdfMedia = url.startsWith('data:application/pdf') || lowerUrl.includes('.pdf') || url.startsWith('blob:');

    // If base64 PDF data, convert to Blob URL so Chrome/Edge native PDF viewer renders scrollable PDF
    if (url.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = url.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
        this.isPdfMedia = true;
      } catch (e) {
        console.error('PDF Blob conversion error', e);
      }
    }

    this.mediaPreviewUrl = url;
    this.sanitizedMediaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.showMediaModal = true;
    this.cdr.detectChanges();
  }

  closeMediaPreview() {
    this.showMediaModal = false;
    this.mediaPreviewUrl = '';
    this.mediaPreviewTitle = '';
    this.mediaZoomScale = 1;
    this.isPdfMedia = false;
    this.isImageMedia = false;
    this.sanitizedMediaUrl = null;
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
              const requester = String(r.requester || r.requesterName || r.createdBy?.name || '').trim();
              return title && title.toLowerCase() !== 'nm' && requester;
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
        if (this.allRequests.length === 0) {
          this.loadSampleData();
        }
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.loadSampleData();
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
    let currentApprover = '';
    
    if (Array.isArray(r.stakeholders) && r.stakeholders.length > 0 && this.currentUser) {
      const pending = r.stakeholders.filter((s: any) => s.status === 'Pending');
      if (pending.length > 0) {
        canApprove = pending[0].email === this.currentUser.email;
        currentApprover = pending[0].name;
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
      status: this.normalizeStatus(r.status),
      description: r.description || r.remarks || '',
      objective: r.objective || r.purposeAndObjective || '',
      requestDate: r.requestDate || r.date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      currentApprover: currentApprover,
      contactNo: r.contactNo || r.phone || '',
      organization: r.organization || r.company || 'Radiant Appliances',
      ccList: r.ccList || [],
      stakeholders: r.stakeholders || [],
      attachments: r.attachments || [],
      createdAt: r.createdAt,
      canApprove: canApprove || r.status === 'Pending'
    };
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
    // For requests tab
    let list = [...this.allRequests];
    if (this.activeFilter !== 'All') {
      list = list.filter(r => r.status === this.activeFilter);
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
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result;
        attachment.preview = dataUrl;
        (attachment as any).url = dataUrl;
        (attachment as any).data = dataUrl;
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
      
      attachments: this.attachments.filter(a => a.file).map(a => ({
        name: a.name,
        fileName: a.file?.name,
        fileSize: a.fileSize,
        remark: a.remark
      })),
      
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
    const remarks = this.selectedRequestCopy.approvalComments || '';
    this.isSubmitting = true;
    this.authService.approveEPRequest(id, remarks).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('EP Request approved successfully', 'success');
        this.closeViewModal();
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
    const remarks = this.selectedRequestCopy.approvalComments || '';
    this.isSubmitting = true;
    this.authService.rejectEPRequest(id, remarks).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('EP Request rejected successfully', 'success');
        this.closeViewModal();
        this.loadRequests();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to reject request', 'error');
      }
    });
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
      { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager' },
      { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM' },
      { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' },
      { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP' },
      { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM' },
      { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD' }
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
  
  trackById(index: number, item: EPRequest) {
    return item._id || item.id || item.requestId || index;
  }
}