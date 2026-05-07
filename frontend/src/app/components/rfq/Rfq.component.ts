import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
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

@Component({
  selector: 'app-rfq',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './Rfq.component.html',
  styleUrls: ['./Rfq.component.scss']
})
export class RfqComponent implements OnInit {
  activeSubMenu: 'rfq-list' | 'create-rfq' | 'approvals' | 'status' = 'rfq-list';

  allRequests: RFQItem[] = [];
  filteredRequests: RFQItem[] = [];
  isLoading = false;
  isPrefillLoading = false;
  searchTerm = '';
  activeFilter: 'All' | 'Pending' | 'Approved' | 'Rejected' | 'In Process' = 'All';

  showCreateModal = false;
  showViewModal = false;
  selectedItem: RFQItem | null = null;
  isSubmitting = false;
  ccInput = '';
  ccList: string[] = [];
  managerOptions: { name: string; email: string; designation?: string; role?: string }[] = [];
  rfqApprovers: RFQApprover[] = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];

  // Line items for the RFQ form
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

  // Serial Number Search Properties
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

  approvalFilterPriority = '';
  approvalFilterStatus = '';
  approvalFilterDepartment = '';
  approvalFilterDate = '';
  approvalFilterVendor = '';

  priorityOptions = ['High', 'Medium', 'Low', 'Urgent'];
  departmentOptions = ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales'];

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser() || {
      name: 'Deepak Kumar', email: 'dk897869@gmail.com',
      department: 'IT', contactNo: '6239785524',
      organization: 'Radiant Appliances', role: 'Manager'
    };
    this.formData.requester   = this.currentUser?.name || '';
    this.formData.email       = this.currentUser?.email || '';
    this.formData.department  = this.currentUser?.department || 'Purchase';
    this.formData.contactNo   = this.currentUser?.contactNo || '';
    this.formData.organization = this.currentUser?.organization || '';
    this.loadRFQs();
    this.loadManagerOptions();
    this.loadAllSerialNumbers();
  }

  // ====================== SERIAL NUMBER SEARCH METHODS ======================
  
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

  // Helper method to map priority from backend format
  private mapPriorityFromBackend(priority: string): 'High' | 'Medium' | 'Low' | 'Urgent' {
    const map: Record<string, 'High' | 'Medium' | 'Low' | 'Urgent'> = {
      'H': 'High',
      'M': 'Medium',
      'L': 'Low',
      'High': 'High',
      'Medium': 'Medium',
      'Low': 'Low',
      'Urgent': 'Urgent'
    };
    return map[priority] || 'Medium';
  }

  prefillFormFromData(data: any) {
    // Prefill basic info with properly typed priority
    this.formData = {
      title: data.titleOfActivity || data.title || '',
      requester: data.requesterName || data.requester || this.currentUser?.name || '',
      email: data.emailId || data.email || this.currentUser?.email || '',
      department: data.department || this.currentUser?.department || 'Purchase',
      contactNo: data.contactNo || this.currentUser?.contactNo || '',
      organization: data.organization || 'Radiant Appliances',
      vendor: data.vendor || '',
      amount: data.amount || 0,
      priority: this.mapPriorityFromBackend(data.priority),
      description: data.purposeAndObjective || data.description || '',
      objective: data.objective || '',
      requestDate: data.requestDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };
    
    // Prefill items
    if (data.items && data.items.length > 0) {
      this.rfqLineItems = data.items.map((item: any) => ({
        description: item.itemDescription || item.description || '',
        uom: item.uom || 'Pcs',
        qty: item.quantity || item.qty || 1,
        make: item.make || '',
        altSimilar: item.alternativeSimilar || item.altSimilar || '',
        vendorRef: item.pictureExistingVendorReference || item.vendorRef || '',
        remark: item.remark || '',
        photoName: item.pictureName || '',
        photoPreview: item.picturePreview || ''
      }));
    }
    
    // Prefill CC list
    this.ccList = data.ccTo || data.ccList || [];
    
    // Prefill approvers
    if (data.stakeholders && data.stakeholders.length > 0) {
      this.rfqApprovers = data.stakeholders.map((s: any) => ({
        managerName: s.managerName || s.name || '',
        email: s.email || '',
        designation: s.designation || '',
        line: s.line || 'Parallel',
        remarks: s.remarks || ''
      }));
    } else if (this.rfqApprovers.length === 0) {
      this.rfqApprovers = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    }
    
    // Set serial number fixed to avoid regeneration
    this.rfqDraftSerialNo = data.uniqueSerialNo || this.generateLocalSerial('RFQ');
    this.rfqSerialFixed = true;
    
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
      { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager' },
      { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM' },
      { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' },
      { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP' },
      { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM' },
      { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD' }
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
    if (x === 'approved') return 'Approved';
    if (x === 'rejected') return 'Rejected';
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
    const epApprovalStatus = r.epApprovalStatus ?? r.epApproval ?? r.ep_status ?? r.epStatus ?? '';
    const rfqStatus = r.rfqStatus ?? r.rfq ?? r.rfq_stage ?? '';
    return {
      ...r,
      id: r._id || r.id,
      requester: r.requester || r.requesterName || r.createdBy?.name || r.user?.name || '—',
      email: this.sanitizeDisplayEmail(rawEmail),
      department: r.department || r.dept || '—',
      title: r.title || r.subject || r.rfqTitle || r.titleOfActivity || '—',
      vendor: r.vendor || r.vendorName || '',
      amount: Number(r.amount ?? r.estimatedAmount ?? 0),
      priority: this.mapPriorityFromBackend(r.priority || 'Medium'),
      status: st,
      uniqueSerialNo: r.uniqueSerialNo || r.serialNo || r.rfqNo || '',
      description: r.description || r.remarks || r.purposeAndObjective || '',
      currentApprover: (cap as string) || '',
      epApprovalStatus: epApprovalStatus ? String(epApprovalStatus) : 'Pending',
      rfqStatus: rfqStatus ? String(rfqStatus) : st,
      requestDate: r.requestDate || r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''),
      createdAt: r.createdAt
    };
  }

  pendingApprovalList(): RFQItem[] {
    return this.allRequests.filter(r => r.status === 'Pending' || r.status === 'In Process');
  }

  getUniqueApprovalDepartments(): string[] {
    const set = new Set<string>();
    this.pendingApprovalList().forEach(r => { if (r.department && r.department !== '—') set.add(r.department); });
    return [...set].sort();
  }

  getApprovalFilteredList(): RFQItem[] {
    let list = this.allRequests;
    if (this.approvalFilterPriority) list = list.filter(r => (r.priority || '').toLowerCase() === this.approvalFilterPriority.toLowerCase());
    if (this.approvalFilterStatus)   list = list.filter(r => r.status === this.approvalFilterStatus);
    if (this.approvalFilterDepartment) list = list.filter(r => r.department === this.approvalFilterDepartment);
    if (this.approvalFilterDate) list = list.filter(r => { const d = r.requestDate || r.createdAt; return d ? String(d).slice(0, 10) === this.approvalFilterDate : false; });
    if (this.approvalFilterVendor.trim()) { const q = this.approvalFilterVendor.toLowerCase(); list = list.filter(r => (r.vendor || '').toLowerCase().includes(q)); }
    return list;
  }

  clearApprovalFilters(): void {
    this.approvalFilterPriority = '';
    this.approvalFilterStatus = '';
    this.approvalFilterDepartment = '';
    this.approvalFilterDate = '';
    this.approvalFilterVendor = '';
  }

  loadRFQs() {
    const startedAt = Date.now();
    this.isLoading = true;
    this.filteredRequests = [];
    this.authService.getRFQs().subscribe({
      next: (res: any) => {
        console.log('RFQ Response:', res);
        const data = res?.data ?? [];
        this.allRequests = Array.isArray(data) ? data.map((r: any) => this.mapRecord(r)) : [];
        this.applyFilter();
        this.completeLoading(startedAt, `Data fetched successfully: ${this.allRequests.length} RFQ request(s) loaded.`, 'success');
      },
      error: (err: any) => {
        console.error('RFQ Load Error:', err);
        this.allRequests = [];
        this.filteredRequests = [];
        this.completeLoading(startedAt, err?.message || 'Failed to load RFQs.', 'error');
      }
    });
  }

  private completeLoading(startedAt: number, message: string, type: 'success' | 'error' | 'info') {
    const elapsed = Date.now() - startedAt;
    const waitMs = Math.max(0, 5000 - elapsed);
    setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.showToast(type, message);
        this.cdr.detectChanges();
      });
    }, waitMs);
  }

  applyFilter() {
    let list = [...this.allRequests];
    if (this.activeFilter !== 'All') list = list.filter(r => r.status === this.activeFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) || r.requester?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) || r.vendor?.toLowerCase().includes(q)
      );
    }
    this.filteredRequests = [...list];
    this.cdr.detectChanges();
  }

  setFilter(f: 'All' | 'Pending' | 'Approved' | 'Rejected' | 'In Process') { this.activeFilter = f; this.applyFilter(); }
  onSearch() { this.applyFilter(); }
  
  countByStatus(status: string): number {
    if (status === 'All') return this.allRequests.length;
    return this.allRequests.filter(r => r.status === status).length;
  }

  // ====================== CREATE MODAL METHODS ======================
  
  openCreate() {
    this.isPrefillLoading = true;
    this.authService.getLoggedInUser().subscribe({
      next: (res: any) => {
        const u = res?.user || res?.data || this.currentUser;
        this.prefillForm(u);
        this.prepareDraftSerial();
        this.loadDraftOptions();
        this.isPrefillLoading = false;
        this.showCreateModal = true;
        this.showToast('success', 'Form prefilled from API profile data.');
      },
      error: () => {
        this.prefillForm(this.currentUser);
        this.prepareDraftSerial();
        this.loadDraftOptions();
        this.isPrefillLoading = false;
        this.showCreateModal = true;
        this.showToast('info', 'Prefilled from local session.');
      }
    });
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
    this.clearSearch();
  }

  private prefillForm(user: any) {
    this.formData = {
      title: '',
      requester: user?.name || '',
      email: user?.email || '',
      department: user?.department || 'Purchase',
      contactNo: user?.contactNo || '',
      organization: user?.organization || 'Radiant Appliances',
      vendor: '', amount: 0, priority: 'High',
      description: '', objective: '',
      requestDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };
    this.rfqLineItems = [
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' },
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' }
    ];
    this.ccInput = '';
    this.ccList = [];
    this.rfqApprovers = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    this.rfqSerialFixed = false;
    this.importFileName = '';
  }

  private resetForm(): void {
    this.formData = {
      title: '',
      requester: this.currentUser?.name || '',
      email: this.currentUser?.email || '',
      department: this.currentUser?.department || 'Purchase',
      contactNo: this.currentUser?.contactNo || '',
      organization: this.currentUser?.organization || 'Radiant Appliances',
      vendor: '', 
      amount: 0, 
      priority: 'High',
      description: '', 
      objective: '',
      requestDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    };
    this.rfqLineItems = [
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' },
      { description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' }
    ];
    this.ccInput = '';
    this.ccList = [];
    this.rfqApprovers = [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
    this.rfqSerialFixed = false;
    this.importFileName = '';
  }

  private prepareDraftSerial() {
    this.rfqSerialFixed = false;
    this.rfqDraftSerialNo = this.generateLocalSerial('RFQ-DRAFT');
  }

  private generateLocalSerial(prefix = 'RFQ'): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${y}${m}${d}-${random}`;
  }

  private getFinalRfqSerial(): string {
    if (this.rfqSerialFixed && this.rfqDraftSerialNo) return this.rfqDraftSerialNo;
    this.rfqDraftSerialNo = this.generateLocalSerial('RFQ');
    this.rfqSerialFixed = true;
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
        return {
          key,
          title: draft.formData?.title || 'Untitled RFQ Draft',
          serialNo: draft.rfqDraftSerialNo || '',
          savedAt: draft.savedAt || ''
        };
      } catch {
        return null;
      }
    }).filter(Boolean) as { key: string; title: string; serialNo: string; savedAt: string }[];
  }

  // ====================== LINE ITEM METHODS ======================
  
  addLineItem() {
    this.rfqLineItems.push({ description: '', uom: 'Pcs', qty: 1, make: '', altSimilar: '', vendorRef: '', remark: '' });
  }

  removeLineItem(index: number) {
    if (this.rfqLineItems.length > 1) this.rfqLineItems.splice(index, 1);
  }

  // ====================== APPROVER METHODS ======================
  
  addApproverRow() {
    this.rfqApprovers.push({ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' });
  }

  removeApproverRow(index: number) {
    this.rfqApprovers.splice(index, 1);
    if (!this.rfqApprovers.length) this.rfqApprovers.push({ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' });
  }

  onManagerChange(row: RFQApprover, selectedName: string) {
    const manager = this.managerOptions.find(m => m.name === selectedName);
    row.managerName = selectedName;
    row.email = manager?.email || '';
    row.designation = manager?.designation || manager?.role || '';
  }

  onApproverEmailChange(row: RFQApprover, email: string) {
    row.email = email.trim();
    const manager = this.managerOptions.find(m => (m.email || '').toLowerCase() === row.email.toLowerCase());
    if (manager) {
      row.managerName = manager.name;
      row.designation = manager.designation || manager.role || '';
    }
  }

  // ====================== CC METHODS ======================
  
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

  onPhotoSelected(item: RFQLineItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    item.photoName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      item.photoPreview = String(reader.result || '');
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  viewPhoto(preview?: string) {
    if (!preview) return;
    this.selectedPhotoPreview = preview;
    this.showPhotoModal = true;
  }

  closePhotoModal() {
    this.showPhotoModal = false;
    this.selectedPhotoPreview = '';
  }

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

  exportCurrentRfqExcel() {
    const rows = this.rfqLineItems.map(item => ({
      'Item Description': item.description,
      UOM: item.uom,
      Quantity: item.qty,
      Make: item.make,
      'Alternative / Similar': item.altSimilar,
      'Vendor Ref': item.vendorRef,
      Remark: item.remark,
      'Photo File': item.photoName || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Items');
    XLSX.writeFile(wb, `${this.rfqDraftSerialNo || 'rfq'}_export.xlsx`);
  }

  importRfqExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const imported = rows.map(row => ({
        description: row['Item Description'] || row.itemDescription || row.description || '',
        uom: row.UOM || row.uom || 'Pcs',
        qty: Number(row.Quantity || row.quantity || row.qty || 1),
        make: row.Make || row.make || '',
        altSimilar: row['Alternative / Similar'] || row.Alternative || row.alternativeSimilar || '',
        vendorRef: row['Vendor Ref'] || row.vendorRef || row.pictureExistingVendorReference || '',
        remark: row.Remark || row.remark || ''
      })).filter(item => item.description);
      if (imported.length) {
        this.rfqLineItems = imported;
        this.showToast('success', `${imported.length} RFQ item(s) imported and ready for submission.`);
      } else {
        this.showToast('info', 'No item rows found in the uploaded Excel file.');
      }
      input.value = '';
      this.cdr.detectChanges();
    };
    reader.readAsArrayBuffer(file);
  }

  saveDraft() {
    const key = this.selectedDraftKey || `rfq_draft_${Date.now()}`;
    const draft = {
      formData: this.formData,
      rfqLineItems: this.rfqLineItems,
      ccList: this.ccList,
      rfqApprovers: this.rfqApprovers,
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

  loadSelectedDraft() {
    if (!this.selectedDraftKey) {
      this.showToast('info', 'Select a saved draft first.');
      return;
    }
    try {
      const draft = JSON.parse(localStorage.getItem(this.selectedDraftKey) || '{}');
      this.formData = draft.formData || this.formData;
      this.rfqLineItems = draft.rfqLineItems || this.rfqLineItems;
      this.ccList = draft.ccList || [];
      this.rfqApprovers = draft.rfqApprovers || [{ managerName: '', email: '', designation: '', line: 'Parallel', remarks: '' }];
      this.rfqDraftSerialNo = this.generateLocalSerial('RFQ-DRAFT');
      this.rfqSerialFixed = false;
      this.showToast('success', 'Draft loaded. Serial number refreshed until final submit.');
    } catch {
      this.showToast('error', 'Failed to load selected draft.');
    }
  }

  private saveHistory(serialNo: string, status: string) {
    try {
      const history = JSON.parse(localStorage.getItem('rfq_order_history') || '[]');
      history.unshift({
        uniqueSerialNo: serialNo,
        title: this.formData.title || 'RFQ',
        status,
        submittedDate: new Date().toISOString(),
        data: {
          formData: this.formData,
          rfqLineItems: this.rfqLineItems,
          ccList: this.ccList,
          rfqApprovers: this.rfqApprovers
        }
      });
      localStorage.setItem('rfq_order_history', JSON.stringify(history.slice(0, 100)));
    } catch {}
  }

  // ====================== SUBMIT RFQ ======================
  
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
        itemDescription: item.description,
        uom: item.uom || 'Pcs',
        quantity: item.qty || 1,
        make: item.make || '',
        alternativeSimilar: item.altSimilar || '',
        pictureExistingVendorReference: item.vendorRef || '',
        remark: item.remark || '',
        pictureName: item.photoName || '',
        picturePreview: item.photoPreview || ''
      }));

    if (validItems.length === 0) {
      this.showToast('error', 'Please add at least one item with description.');
      return;
    }

    this.isSubmitting = true;
    
    const priorityMap: { [key: string]: string } = {
      'High': 'H', 'Medium': 'M', 'Low': 'L', 'Urgent': 'H'
    };

    const finalSerialNo = this.getFinalRfqSerial();
    const payload = {
      uniqueSerialNo: finalSerialNo,
      titleOfActivity: this.formData.title,
      requesterName: this.formData.requester,
      department: this.formData.department,
      emailId: this.formData.email,
      contactNo: this.formData.contactNo,
      organization: this.formData.organization,
      priority: priorityMap[this.formData.priority || 'High'] || 'M',
      purposeAndObjective: this.formData.description || '',
      items: validItems,
      ccTo: this.ccList,
      status: 'Pending',
      requestDate: new Date().toISOString()
    };

    console.log('📤 Submitting RFQ:', payload);

    this.authService.createRFQ(payload).subscribe({
      next: (res: any) => {
        console.log('✅ RFQ created:', res);
        const newItem = res?.data || res;
        this.allRequests.unshift(this.mapRecord({ 
          ...newItem, 
          id: newItem._id || newItem.id,
          title: newItem.titleOfActivity
        }));
        this.applyFilter();
        this.showCreateModal = false;
        this.isSubmitting = false;
        this.saveHistory(finalSerialNo, 'Pending');
        this.showToast('success', `RFQ submitted successfully. Serial No: ${finalSerialNo}`);
        this.resetForm();
        this.clearSearch();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ RFQ error:', err);
        this.isSubmitting = false;
        this.showToast('error', err?.message || 'Failed to create RFQ.');
        this.cdr.detectChanges();
      }
    });
  }

  // ====================== VIEW METHODS ======================
  
  viewItem(item: RFQItem) { 
    this.selectedItem = item; 
    this.showViewModal = true; 
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedItem = null;
  }

  // ====================== APPROVE/REJECT METHODS ======================
  
  approveItem(item: RFQItem) {
    const id = item._id || item.id;
    if (!id) {
      this.showToast('error', 'Cannot approve: No ID found');
      return;
    }
    this.authService.approveRFQ(id).subscribe({
      next: () => { 
        item.status = 'Approved'; 
        this.applyFilter(); 
        this.showToast('success', `"${item.title}" approved!`); 
        this.cdr.detectChanges();
        if (this.showViewModal) this.showViewModal = false;
      },
      error: (err: any) => { 
        this.showToast('error', err?.message || 'Approval failed.'); 
      }
    });
  }

  rejectItem(item: RFQItem) {
    const id = item._id || item.id;
    if (!id) {
      this.showToast('error', 'Cannot reject: No ID found');
      return;
    }
    this.authService.rejectRFQ(id).subscribe({
      next: () => { 
        item.status = 'Rejected'; 
        this.applyFilter(); 
        this.showToast('info', `"${item.title}" rejected.`); 
        this.cdr.detectChanges();
        if (this.showViewModal) this.showViewModal = false;
      },
      error: (err: any) => { 
        this.showToast('error', err?.message || 'Rejection failed.'); 
      }
    });
  }

  // ====================== UTILITY METHODS ======================
  
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
    if (x === 'high') return 'high';
    if (x === 'low') return 'low';
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