import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import * as XLSX from 'xlsx';

interface RFQItem {
  _id?: string; id?: string;
  title: string;
  requester: string;
  email?: string;
  department: string;
  vendor?: string;
  amount?: number;
  priority: 'High' | 'Medium' | 'Low' | 'Urgent';
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Process';
  description?: string;
  requestDate?: string;
  currentApprover?: string;
  epApprovalStatus?: string;
  rfqStatus?: string;
  uniqueSerialNo?: string;
  createdAt?: string;
  contactNo?: string;
  organization?: string;
  objective?: string;
  stakeholders?: any[];
  ccList?: string[];
  attachments?: any[];
  items?: RFQLineItem[];
  approvalDate?: string;
  approvedBy?: string;
  currentStage?: string;
  vendorRequestCreated?: boolean;
  quotationCompleted?: boolean;
}

interface RFQLineItem {
  description: string;
  uom: string;
  qty: number;
  make: string;
  altSimilar: string;
  vendorRef: string;
  remark: string;
  photoName?: string;
  photoPreview?: string;
}

interface RFQApprover {
  managerName: string;
  email: string;
  designation: string;
  line: string;
  remarks: string;
}

interface RFQAttachment {
  name: string;
  fileName: string;
}

@Component({
  selector: 'app-rfq-requisition',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rfq-requisition.html',
  styleUrls: ['./rfq-requisition.scss']
})
export class RfqRequisitionComponent implements OnInit, OnDestroy {
  activeSubMenu: 'rfq-list' | 'create-rfq' | 'approvals' | 'status' = 'rfq-list';

  @Input() hideInternalSidebar = false;

  @Input() set initialSubMenu(value: 'rfq-list' | 'create-rfq' | 'approvals' | 'status' | undefined) {
    if (!value) return;
    this.activeSubMenu = value;
    if (value === 'approvals' || value === 'status') {
      this.loadRFQs();
    }
    if (value === 'create-rfq') {
      this.initCreateForm();
    }
  }

  allRequests: RFQItem[] = [];
  filteredRequests: RFQItem[] = [];
  pendingRequests: RFQItem[] = [];
  isLoading = false;
  isPrefillLoading = false;
  searchTerm = '';
  activeFilter: 'All' | 'Pending' | 'Approved' | 'Rejected' | 'In Process' = 'Pending';

  showCreateModal = false;
  showViewModal = false;
  selectedItem: RFQItem | null = null;
  isSubmitting = false;
  isEditMode = false;
  editingSerialNo = '';

  // Confirmation modals
  showApproveConfirm = false;
  showRejectConfirm = false;
  confirmItem: RFQItem | null = null;

  ccInput = '';
  ccList: string[] = [];
  managerOptions: { name: string; email: string; designation?: string; role?: string }[] = [];
  rfqApprovers: RFQApprover[] = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
  rfqAttachments: RFQAttachment[] = [{ name: 'Attachment 1', fileName: '' }];

  rfqLineItems: RFQLineItem[] = [
    { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' },
    { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' }
  ];
  rfqDraftSerialNo = '';
  rfqSerialFixed = false;
  showPhotoModal = false;
  selectedPhotoPreview = '';
  importFileName = '';
  draftOptions: { key: string; title: string; serialNo: string; savedAt: string }[] = [];
  selectedDraftKey = '';

  searchSerialNo = '';
  searchResult: any = null;
  isSearching = false;
  showSearchSuggestions = false;
  searchSuggestions: any[] = [];

  uomOptions = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Nos', 'Unit', 'Pair'];

  formData: Partial<RFQItem> = {
    title: '', requester: '', email: '', department: '',
    vendor: '', amount: 0, priority: 'High',
    description: '', requestDate: new Date().toISOString().split('T')[0],
    contactNo: '', organization: '', objective: ''
  };

  currentUser: any = null;

  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  priorityOptions = ['High', 'Medium', 'Low', 'Urgent'];
  departmentOptions = ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales'];

  currentDate: Date = new Date();
  currentTime = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.currentDate = new Date();
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);

    this.currentUser = this.authService.getUser() || {
      name: 'Deepak Kumar', email: 'dk897869@gmail.com',
      department: 'IT', contactNo: '6239785524',
      organization: 'Radiant Appliances', role: 'Manager'
    };
    this.formData.requester    = this.currentUser?.name || '';
    this.formData.email        = this.currentUser?.email || '';
    this.formData.department   = this.currentUser?.department || 'Purchase';
    this.formData.contactNo    = this.currentUser?.contactNo || '';
    this.formData.organization = this.currentUser?.organization || '';

    if (this.hideInternalSidebar && this.activeSubMenu === 'create-rfq') {
      this.initCreateForm();
    } else if (this.activeSubMenu !== 'create-rfq') {
      this.loadRFQs();
    }
    this.loadManagerOptions();
    this.loadAllSerialNumbers();
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private updateClock() {
    this.currentDate = new Date();
    this.currentTime = this.currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  // ====================== SERIAL NUMBER SEARCH ======================

  loadAllSerialNumbers() {
    this.authService.getAllSerialNumbers('rfq').subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.searchSuggestions = res.data;
        }
      },
      error: () => {}
    });
  }

  onSearchSerialInput() {
    if (this.searchSerialNo.length >= 3) {
      const filtered = this.searchSuggestions.filter((s: any) =>
        s.uniqueSerialNo?.toLowerCase().includes(this.searchSerialNo.toLowerCase())
      );
      this.searchSuggestions = filtered.slice(0, 10);
      this.showSearchSuggestions = this.searchSuggestions.length > 0;
    } else {
      this.showSearchSuggestions = false;
    }
  }

  selectSuggestion(suggestion: any) {
    this.searchSerialNo = suggestion.uniqueSerialNo;
    this.showSearchSuggestions = false;
    this.searchBySerialNumber();
  }

  searchBySerialNumber() {
    if (!this.searchSerialNo) return;
    this.isSearching = true;
    this.authService.searchBySerialNumber(this.searchSerialNo).subscribe({
      next: (res: any) => {
        this.isSearching = false;
        if (res.success && res.data) {
          this.searchResult = res;
          this.prefillFormFromData(res.data);
          this.showToast('success', `Data loaded from serial number: ${this.searchSerialNo}`);
        } else {
          this.searchResult = { success: false, message: 'No data found' };
          this.showToast('error', 'No data found for this serial number');
        }
      },
      error: (err: any) => {
        this.isSearching = false;
        this.searchResult = { success: false, message: err.error?.message || 'Search failed' };
        this.showToast('error', 'Failed to search serial number');
      }
    });
  }

  clearSearch() {
    this.searchSerialNo = '';
    this.searchResult = null;
    this.showSearchSuggestions = false;
  }

  private mapPriorityFromBackend(priority: string): 'High' | 'Medium' | 'Low' | 'Urgent' {
    const map: Record<string, 'High' | 'Medium' | 'Low' | 'Urgent'> = {
      'H': 'High', 'M': 'Medium', 'L': 'Low',
      'High': 'High', 'Medium': 'Medium', 'Low': 'Low', 'Urgent': 'Urgent'
    };
    return map[priority] || 'Medium';
  }

  prefillFormFromData(data: any) {
    this.formData = {
      title:        data.titleOfActivity || data.title || '',
      requester:    data.requesterName || data.requester || this.currentUser?.name || '',
      email:        data.emailId || data.email || this.currentUser?.email || '',
      department:   data.department || this.currentUser?.department || 'Purchase',
      contactNo:    data.contactNo || this.currentUser?.contactNo || '',
      organization: data.organization || 'Radiant Appliances',
      vendor:       data.vendor || '',
      amount:       data.amount || 0,
      priority:     this.mapPriorityFromBackend(data.priority),
      description:  data.purposeAndObjective || data.description || '',
      objective:    data.objective || '',
      requestDate:  data.requestDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };

    if (data.items && data.items.length > 0) {
      this.rfqLineItems = data.items.map((item: any) => ({
        description: item.itemDescription || item.description || '',
        uom:         item.uom || 'Pcs',
        qty:         item.quantity || item.qty || 1,
        make:        item.make || '',
        altSimilar:  item.alternativeSimilar || item.altSimilar || '',
        vendorRef:   item.pictureExistingVendorReference || item.vendorRef || '',
        remark:      item.remark || '',
        photoName:   item.pictureName || '',
        photoPreview:item.picturePreview || ''
      }));
    }

    this.ccList = data.ccTo || data.ccList || [];

    if (data.stakeholders && data.stakeholders.length > 0) {
      this.rfqApprovers = data.stakeholders.map((s: any) => ({
        managerName: s.managerName || s.name || '',
        email:       s.email || '',
        designation: s.designation || '',
        line:        s.line || 'Parallel',
        remarks:     s.remarks || ''
      }));
    } else if (!this.rfqApprovers.length) {
      this.rfqApprovers = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    }

    this.rfqDraftSerialNo = data.uniqueSerialNo || this.generateLocalSerial('RFQ');
    this.rfqSerialFixed   = true;
    this.cdr.detectChanges();
  }

  reuseData() {
    if (this.searchResult?.data) {
      this.prefillFormFromData(this.searchResult.data);
      this.showToast('success', `Data reused from serial number: ${this.searchSerialNo}`);
      this.clearSearch();
    }
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
      { name: 'Vijay Parashar',     email: 'vijay.parashar@radiant.com',     designation: 'Manager' },
      { name: 'Ravib',              email: 'ravib@radiant.com',               designation: 'A-GM'    },
      { name: 'Shailendra Chothe',  email: 'shailendra.chothe@radiant.com',  designation: 'VP'      },
      { name: 'Sanjay Munshi',      email: 'sanjay.munshi@radiant.com',      designation: 'S-VP'    },
      { name: 'Wang Xianwen',       email: 'wang.xianwen@radiant.com',       designation: 'GM'      },
      { name: 'Raminder Singh',     email: 'raminder.singh@radiant.com',     designation: 'MD'      }
    ];
  }

  showToast(type: 'success' | 'error' | 'info', message: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.cdr.detectChanges();
    const ms = type === 'info' ? 6000 : 5000;
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, ms);
  }

  closeToast() {
    this.toast = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private normalizeStatus(s: string | undefined): RFQItem['status'] {
    const x = (s || 'Pending').toString().trim().toLowerCase();
    if (x === 'approved')  return 'Approved';
    if (x === 'rejected')  return 'Rejected';
    if (x === 'in process' || x === 'in-process' || x === 'inprocess') return 'In Process';
    return 'Pending';
  }

  private sanitizeDisplayEmail(e: string | undefined): string {
    const x = (e || '').trim();
    if (x && !x.includes('@') && /^[a-f0-9]{24}$/i.test(x)) return '';
    return x;
  }

  private mapRecord(r: any): RFQItem {
    const st = this.normalizeStatus(r.status);
    let cap = r.currentApprover;
    if (cap && typeof cap === 'object') cap = (cap as any).name || (cap as any).email || '';
    const rawEmail = r.email || r.requesterEmail || r.createdBy?.email || r.user?.email || '';
    return {
      ...r,
      id:              r._id || r.id,
      requester:       r.requester || r.requesterName || r.createdBy?.name || r.user?.name || '—',
      email:           this.sanitizeDisplayEmail(rawEmail),
      department:      r.department || r.dept || '—',
      title:           r.title || r.subject || r.rfqTitle || r.titleOfActivity || '—',
      vendor:          r.vendor || r.vendorName || '',
      amount:          Number(r.amount ?? r.estimatedAmount ?? 0),
      priority:        this.mapPriorityFromBackend(r.priority || 'Medium'),
      status:          st,
      uniqueSerialNo:  r.uniqueSerialNo || r.serialNo || r.rfqNo || '',
      description:     r.description || r.remarks || r.purposeAndObjective || '',
      currentApprover: (cap as string) || '',
      epApprovalStatus:r.epApprovalStatus ? String(r.epApprovalStatus) : 'Pending',
      rfqStatus:       r.rfqStatus ? String(r.rfqStatus) : st,
      requestDate:     r.requestDate || r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''),
      createdAt:       r.createdAt,
      approvalDate:    r.approvalDate || '',
      approvedBy:      r.approvedBy || '',
      currentStage:    r.currentStage || 'RFQ',
      vendorRequestCreated: r.vendorRequestCreated || false,
      quotationCompleted:   r.quotationCompleted || false
    };
  }

  pendingApprovalList(): RFQItem[] {
    return this.allRequests.filter(r => r.status === 'Pending');
  }

  loadRFQs() {
    const startedAt = Date.now();
    this.isLoading = true;
    this.filteredRequests = [];
    this.authService.getRFQs().subscribe({
      next: (res: any) => {
        const data = res?.data ?? [];
        this.allRequests = Array.isArray(data) ? data.map((r: any) => this.mapRecord(r)) : [];
        // Only show Pending RFQs in the main list
        this.pendingRequests = this.allRequests.filter(r => r.status === 'Pending');
        this.applyFilter();
        this.completeLoading(startedAt, `Data fetched successfully: ${this.pendingRequests.length} pending RFQ request(s) loaded.`, 'success');
      },
      error: (err: any) => {
        this.allRequests = [];
        this.pendingRequests = [];
        this.filteredRequests = [];
        this.completeLoading(startedAt, err?.message || 'Failed to load RFQs.', 'error');
      }
    });
  }

  private completeLoading(startedAt: number, message: string, type: 'success' | 'error' | 'info') {
    const elapsed = Date.now() - startedAt;
    const waitMs  = Math.max(0, 500 - elapsed);
    setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.showToast(type, message);
        this.cdr.detectChanges();
      });
    }, waitMs);
  }

  applyFilter() {
    let list = [...this.pendingRequests];
    if (this.activeFilter !== 'All' && this.activeFilter !== 'Pending') {
      // Since we only show pending in main list, only 'All' and 'Pending' make sense
      list = this.pendingRequests;
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.requester?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.vendor?.toLowerCase().includes(q) ||
        r.uniqueSerialNo?.toLowerCase().includes(q)
      );
    }
    this.filteredRequests = [...list];
    this.cdr.detectChanges();
  }

  setFilter(f: 'All' | 'Pending' | 'Approved' | 'Rejected' | 'In Process') {
    this.activeFilter = f;
    this.applyFilter();
  }

  onSearch() { this.applyFilter(); }

  countByStatus(status: string): number {
    if (status === 'All') return this.pendingRequests.length;
    if (status === 'Pending') return this.pendingRequests.length;
    return this.allRequests.filter(r => r.status === status).length;
  }

  // ====================== CREATE / EDIT FORM ======================

  openCreate() { 
    this.isEditMode = false;
    this.editingSerialNo = '';
    this.initCreateForm(true); 
  }

  openEditFromList(item: RFQItem) {
    if (item.status !== 'Pending') {
      this.showToast('info', 'Only pending RFQs can be edited.');
      return;
    }
    this.isEditMode = true;
    this.editingSerialNo = item.uniqueSerialNo || '';
    // Load the full data from the backend
    const id = item._id || item.id;
    if (id) {
      this.isPrefillLoading = true;
      this.authService.getRFQById(String(id)).subscribe({
        next: (res: any) => {
          const data = res?.data || res?.rfq || item;
          this.prefillFormFromData(data);
          this.isPrefillLoading = false;
          this.activeSubMenu = 'create-rfq';
          this.showCreateModal = false;
          this.showToast('success', `Loaded RFQ: ${item.uniqueSerialNo}`);
          this.cdr.detectChanges();
        },
        error: () => {
          this.prefillFormFromData(item);
          this.isPrefillLoading = false;
          this.activeSubMenu = 'create-rfq';
          this.showCreateModal = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.prefillFormFromData(item);
      this.activeSubMenu = 'create-rfq';
      this.showCreateModal = false;
      this.cdr.detectChanges();
    }
  }

  viewItem(item: RFQItem) {
    // Open the full form for editing if it's pending
    if (item.status === 'Pending') {
      this.openEditFromList(item);
      return;
    }
    // For non-pending items, show the view modal
    const id = item._id || item.id;
    if (id) {
      this.isPrefillLoading = true;
      this.authService.getRFQById(String(id)).subscribe({
        next: (res: any) => {
          const data = res?.data || res?.rfq || item;
          this.selectedItem      = this.mapRecord(data);
          this.showViewModal     = true;
          this.isPrefillLoading  = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.selectedItem      = item;
          this.showViewModal     = true;
          this.isPrefillLoading  = false;
          this.cdr.detectChanges();
        }
      });
      return;
    }
    this.selectedItem  = item;
    this.showViewModal = true;
    this.cdr.detectChanges();
  }

  initCreateForm(openModal = false) {
    this.isPrefillLoading = true;
    this.authService.getLoggedInUser().subscribe({
      next: (res: any) => {
        const u = res?.user || res?.data || this.currentUser;
        if (!this.isEditMode) {
          this.prefillForm(u);
          this.prepareDraftSerial();
        }
        this.loadDraftOptions();
        this.isPrefillLoading = false;
        if (openModal) this.showCreateModal = true;
        this.activeSubMenu = 'create-rfq';
        if (!this.isEditMode) {
          this.showToast('success', 'Form prefilled from API profile data.');
        }
      },
      error: () => {
        if (!this.isEditMode) {
          this.prefillForm(this.currentUser);
          this.prepareDraftSerial();
        }
        this.loadDraftOptions();
        this.isPrefillLoading = false;
        if (openModal) this.showCreateModal = true;
        this.activeSubMenu = 'create-rfq';
        if (!this.isEditMode) {
          this.showToast('info', 'Prefilled from local session.');
        }
      }
    });
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.isEditMode = false;
    this.editingSerialNo = '';
    this.resetForm();
    this.clearSearch();
    if (this.activeSubMenu === 'create-rfq') {
      this.activeSubMenu = 'rfq-list';
    }
  }

  private prefillForm(user: any) {
    this.formData = {
      title:        '',
      requester:    user?.name || '',
      email:        user?.email || '',
      department:   user?.department || 'Purchase',
      contactNo:    user?.contactNo || '',
      organization: user?.organization || 'Radiant Appliances',
      vendor: '', amount: 0, priority: 'High',
      description: '', objective: '',
      requestDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };
    this.rfqLineItems = [
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' },
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' }
    ];
    this.ccInput        = '';
    this.ccList         = [];
    this.rfqApprovers   = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    this.rfqAttachments = [{ name: 'Attachment 1', fileName: '' }];
    this.rfqSerialFixed = false;
    this.importFileName = '';
  }

  private resetForm(): void {
    this.formData = {
      title:        '',
      requester:    this.currentUser?.name || '',
      email:        this.currentUser?.email || '',
      department:   this.currentUser?.department || 'Purchase',
      contactNo:    this.currentUser?.contactNo || '',
      organization: this.currentUser?.organization || 'Radiant Appliances',
      vendor: '', amount: 0, priority: 'High',
      description: '', objective: '',
      requestDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };
    this.rfqLineItems = [
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' },
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' }
    ];
    this.ccInput        = '';
    this.ccList         = [];
    this.rfqApprovers   = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    this.rfqAttachments = [{ name: 'Attachment 1', fileName: '' }];
    this.rfqSerialFixed = false;
    this.importFileName = '';
    this.isEditMode = false;
    this.editingSerialNo = '';
  }

  private prepareDraftSerial() {
    this.rfqSerialFixed   = false;
    this.rfqDraftSerialNo = this.generateLocalSerial('RFQ-DRAFT');
  }

  private generateLocalSerial(prefix = 'RFQ'): string {
    const now    = new Date();
    const y      = now.getFullYear();
    const m      = String(now.getMonth() + 1).padStart(2, '0');
    const d      = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${y}${m}${d}-${random}`;
  }

  private getFinalRfqSerial(): string {
    if (this.isEditMode && this.editingSerialNo) return this.editingSerialNo;
    if (this.rfqSerialFixed && this.rfqDraftSerialNo) return this.rfqDraftSerialNo;
    this.rfqDraftSerialNo = this.generateLocalSerial('RFQ');
    this.rfqSerialFixed   = true;
    return this.rfqDraftSerialNo;
  }

  private draftKeys(): string[] {
    try { return JSON.parse(localStorage.getItem('rfq_draft_keys') || '[]'); } catch { return []; }
  }

  private setDraftKeys(keys: string[]) {
    localStorage.setItem('rfq_draft_keys', JSON.stringify(keys));
  }

  loadDraftOptions() {
    this.draftOptions = this.draftKeys().map(key => {
      try {
        const draft = JSON.parse(localStorage.getItem(key) || '{}');
        return { key, title: draft.formData?.title || 'Untitled RFQ Draft', serialNo: draft.rfqDraftSerialNo || '', savedAt: draft.savedAt || '' };
      } catch { return null; }
    }).filter(Boolean) as { key: string; title: string; serialNo: string; savedAt: string }[];
  }

  // ====================== LINE ITEMS ======================

  addLineItem() {
    this.rfqLineItems.push({ description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' });
  }

  removeLineItem(index: number) {
    if (this.rfqLineItems.length > 1) this.rfqLineItems.splice(index, 1);
  }

  // ====================== APPROVERS ======================

  addApproverRow() {
    this.rfqApprovers.push({ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' });
  }

  removeApproverRow(index: number) {
    this.rfqApprovers.splice(index, 1);
    if (!this.rfqApprovers.length) this.rfqApprovers.push({ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' });
  }

  onManagerLookup(row: RFQApprover, value: string) {
    const term    = (value || '').trim().toLowerCase();
    const manager = this.managerOptions.find(m => (m.name || '').toLowerCase() === term || (m.email || '').toLowerCase() === term);
    row.managerName  = value;
    row.email        = manager?.email || '';
    row.designation  = manager?.designation || manager?.role || '';
  }

  onApproverEmailChange(row: RFQApprover, email: string) {
    row.email = email.trim();
    const manager = this.managerOptions.find(m => (m.email || '').toLowerCase() === row.email.toLowerCase());
    if (manager) {
      row.managerName = manager.name;
      row.designation = manager.designation || manager.role || '';
    }
  }

  // ====================== CC ======================

  addCc(value = this.ccInput) {
    const raw = (value || '').trim();
    if (!raw) return;
    raw.split(/[;,\s\n]+/).map(x => x.trim().replace(/[<>]/g, '')).filter(Boolean).forEach(email => {
      if (email.includes('@') && !this.ccList.includes(email)) this.ccList.push(email);
    });
    this.ccInput = '';
  }

  addMultipleCc(event: ClipboardEvent) {
    const value = event.clipboardData?.getData('text') || '';
    if (!value) return;
    this.addCc(value);
    event.preventDefault();
  }

  removeCc(index: number) { this.ccList.splice(index, 1); }

  // ====================== PHOTO ======================

  onPhotoSelected(item: RFQLineItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    item.photoName = file.name;
    const reader   = new FileReader();
    reader.onload  = () => { item.photoPreview = String(reader.result || ''); this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  viewPhoto(preview?: string) {
    if (!preview) return;
    this.selectedPhotoPreview = preview;
    this.showPhotoModal       = true;
  }

  closePhotoModal() {
    this.showPhotoModal       = false;
    this.selectedPhotoPreview = '';
  }

  // ====================== ATTACHMENTS ======================

  addRfqAttachment() {
    this.rfqAttachments.push({ name: `Attachment ${this.rfqAttachments.length + 1}`, fileName: '' });
  }

  removeRfqAttachment(index: number) {
    if (this.rfqAttachments.length > 1) this.rfqAttachments.splice(index, 1);
  }

  onRfqAttachmentSelected(attachment: RFQAttachment, event: Event) {
    const input       = event.target as HTMLInputElement;
    attachment.fileName = input.files?.[0]?.name || '';
  }

  // ====================== EXCEL ======================

  downloadExcelTemplate() {
    const rows = [
      ['Item Description', 'UOM', 'Quantity', 'Make', 'Alternative / Similar', 'Vendor Ref', 'Remark'],
      ['Example item', 'Pcs', 1, 'Example make', 'Equivalent model', 'Vendor catalog ref', 'Sample remark']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Import');
    XLSX.writeFile(wb, 'rfq_import_template.xlsx');
  }

  importRfqExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const imported = rows.map(row => ({
        description: row['Item Description'] || row.itemDescription || row.description || '',
        uom:         row.UOM || row.uom || 'Pcs',
        qty:         Number(row.Quantity || row.quantity || row.qty || 1),
        make:        row.Make || row.make || '',
        altSimilar:  row['Alternative / Similar'] || row.Alternative || row.alternativeSimilar || '',
        vendorRef:   row['Vendor Ref'] || row.vendorRef || '',
        remark:      row.Remark || row.remark || ''
      })).filter(item => item.description);
      if (imported.length) {
        this.rfqLineItems = imported;
        this.showToast('success', `${imported.length} RFQ item(s) imported.`);
      } else {
        this.showToast('info', 'No item rows found in the uploaded file.');
      }
      input.value = '';
      this.cdr.detectChanges();
    };
    reader.readAsArrayBuffer(file);
  }

  // ====================== DRAFT ======================

  saveDraft() {
    const key   = this.selectedDraftKey || `rfq_draft_${Date.now()}`;
    const draft = {
      formData: this.formData, rfqLineItems: this.rfqLineItems,
      ccList: this.ccList, rfqApprovers: this.rfqApprovers,
      rfqAttachments: this.rfqAttachments,
      rfqDraftSerialNo: this.rfqDraftSerialNo || this.generateLocalSerial('RFQ-DRAFT'),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(draft));
    const keys = this.draftKeys();
    if (!keys.includes(key)) this.setDraftKeys([key, ...keys]);
    this.selectedDraftKey = key;
    this.loadDraftOptions();
    this.showToast('success', 'RFQ draft saved. You can load and submit it later.');
  }

  private saveHistory(serialNo: string, status: string) {
    try {
      const history = JSON.parse(localStorage.getItem('rfq_order_history') || '[]');
      history.unshift({
        uniqueSerialNo: serialNo, title: this.formData.title || 'RFQ',
        status, submittedDate: new Date().toISOString(),
        data: { formData: this.formData, rfqLineItems: this.rfqLineItems, ccList: this.ccList, rfqApprovers: this.rfqApprovers }
      });
      localStorage.setItem('rfq_order_history', JSON.stringify(history.slice(0, 100)));
    } catch {}
  }

  // ====================== SUBMIT / UPDATE ======================

  submitRFQ() {
    if (!this.formData.title?.trim()) {
      this.showToast('error', 'Title of Activity is required.');
      return;
    }
    if (!this.formData.requester?.trim()) {
      this.showToast('error', 'Requester name is required.');
      return;
    }
    const validApprovers = this.rfqApprovers.filter(a => a.email);
    if (!validApprovers.length) {
      this.showToast('error', 'Please add at least one approver.');
      return;
    }
    const validItems = this.rfqLineItems
      .filter(item => item.description && item.description.trim())
      .map(item => ({
        itemDescription: item.description, uom: item.uom || 'Pcs', quantity: item.qty || 1,
        make: item.make || '', alternativeSimilar: item.altSimilar || '',
        pictureExistingVendorReference: item.vendorRef || '', remark: item.remark || '',
        pictureName: item.photoName || '', picturePreview: item.photoPreview || ''
      }));
    if (!validItems.length) {
      this.showToast('error', 'Please add at least one item with description.');
      return;
    }

    this.isSubmitting = true;
    const priorityMap: { [key: string]: string } = { 'High': 'H', 'Medium': 'M', 'Low': 'L', 'Urgent': 'H' };
    const finalSerialNo = this.getFinalRfqSerial();

    const payload = {
      uniqueSerialNo:    finalSerialNo,
      titleOfActivity:   this.formData.title,
      requesterName:     this.formData.requester,
      department:        this.formData.department,
      emailId:           this.formData.email,
      contactNo:         this.formData.contactNo,
      organization:      this.formData.organization,
      priority:          priorityMap[this.formData.priority || 'High'] || 'M',
      purposeAndObjective: this.formData.description || '',
      items:             validItems,
      ccTo:              this.ccList,
      attachments:       this.rfqAttachments.filter(a => a.fileName),
      status:            'Pending',
      requestDate:       new Date().toISOString()
    };

    if (this.isEditMode && this.editingSerialNo) {
      // Update existing RFQ
      const id = this.allRequests.find(r => r.uniqueSerialNo === this.editingSerialNo)?._id || this.editingSerialNo;
      this.authService.updateRFQ(id, payload).subscribe({
        next: (res: any) => {
          const updatedItem = res?.data || res;
          const index = this.allRequests.findIndex(r => r.uniqueSerialNo === this.editingSerialNo);
          if (index !== -1) {
            this.allRequests[index] = this.mapRecord({ ...updatedItem, id: updatedItem._id || updatedItem.id });
          }
          this.pendingRequests = this.allRequests.filter(r => r.status === 'Pending');
          this.applyFilter();
          this.showCreateModal = false;
          this.isSubmitting = false;
          this.showToast('success', `RFQ updated successfully. Serial No: ${finalSerialNo}`);
          this.resetForm();
          this.clearSearch();
          this.activeSubMenu = 'rfq-list';
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.isSubmitting = false;
          this.showToast('error', err?.message || 'Failed to update RFQ.');
          this.cdr.detectChanges();
        }
      });
    } else {
      // Create new RFQ
      this.authService.createRFQ(payload).subscribe({
        next: (res: any) => {
          const newItem = res?.data || res;
          this.allRequests.unshift(this.mapRecord({ ...newItem, id: newItem._id || newItem.id, title: newItem.titleOfActivity || newItem.title }));
          this.pendingRequests = this.allRequests.filter(r => r.status === 'Pending');
          this.applyFilter();
          this.showCreateModal = false;
          this.isSubmitting = false;
          this.saveHistory(finalSerialNo, 'Pending');
          this.showToast('success', `RFQ submitted successfully. Serial No: ${finalSerialNo}`);
          this.resetForm();
          this.clearSearch();
          this.activeSubMenu = 'rfq-list';
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.isSubmitting = false;
          this.showToast('error', err?.message || 'Failed to create RFQ.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedItem  = null;
  }

  // ====================== APPROVE / REJECT WITH CONFIRM ======================

  approveItem(item: RFQItem) {
    this.confirmItem       = item;
    this.showApproveConfirm = true;
    if (this.showViewModal) this.closeViewModal();
  }

  rejectItem(item: RFQItem) {
    this.confirmItem      = item;
    this.showRejectConfirm = true;
    if (this.showViewModal) this.closeViewModal();
  }

  confirmApprove() {
    this.showApproveConfirm = false;
    if (!this.confirmItem) return;
    const item = this.confirmItem;
    const id   = item._id || item.id;
    if (!id) { this.showToast('error', 'Cannot approve: No ID found'); return; }

    this.authService.approveRFQ(id).subscribe({
      next: () => {
        item.status       = 'Approved';
        item.approvalDate = new Date().toISOString();
        item.approvedBy   = this.currentUser?.name || 'Admin';
        item.currentStage = 'Vendor Request';
        item.vendorRequestCreated = false;
        // Remove from pending list
        this.pendingRequests = this.allRequests.filter(r => r.status === 'Pending');
        this.applyFilter();
        this.showToast('success', `"${item.title}" approved! RFQ moved to Vendor Request stage.`);
        this.confirmItem = null;
        this.cdr.detectChanges();
        // Refresh the list
        this.loadRFQs();
      },
      error: (err: any) => {
        this.showToast('error', err?.message || 'Approval failed.');
        this.confirmItem = null;
      }
    });
  }

  confirmReject() {
    this.showRejectConfirm = false;
    if (!this.confirmItem) return;
    const item = this.confirmItem;
    const id   = item._id || item.id;
    if (!id) { this.showToast('error', 'Cannot reject: No ID found'); return; }

    this.authService.rejectRFQ(id).subscribe({
      next: () => {
        item.status       = 'Rejected';
        item.currentStage = 'Rejected';
        // Remove from pending list
        this.pendingRequests = this.allRequests.filter(r => r.status === 'Pending');
        this.applyFilter();
        this.showToast('info', `"${item.title}" rejected.`);
        this.confirmItem = null;
        this.cdr.detectChanges();
        // Refresh the list
        this.loadRFQs();
      },
      error: (err: any) => {
        this.showToast('error', err?.message || 'Rejection failed.');
        this.confirmItem = null;
      }
    });
  }

  // ====================== UTILITY ======================

  isAdminOrManager(): boolean {
    const role = this.authService.getUserRole();
    return role === 'Admin' || role === 'Manager';
  }

  formatDate(d: string | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  formatAmount(a: number | undefined): string {
    return a ? '₹' + a.toLocaleString('en-IN') : '—';
  }

  getPriorityClass(p: string): string {
    const x = (p || 'Medium').toLowerCase();
    if (x === 'high')   return 'high';
    if (x === 'low')    return 'low';
    if (x === 'urgent') return 'urgent';
    return 'medium';
  }

  getEpStatusClass(status: string): string {
    if (!status) return 'pending';
    const s = status.toLowerCase().trim();
    if (s === 'in-process' || s === 'in process' || s === 'inprocess') return 'in-process';
    if (s === 'approved') return 'approved';
    if (s === 'rejected') return 'rejected';
    return 'pending';
  }

  trackById(_: number, item: any) {
    return item._id || item.id || _;
  }
}