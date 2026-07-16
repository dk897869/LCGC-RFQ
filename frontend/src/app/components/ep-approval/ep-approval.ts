import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { CreateEPRequestModalComponent } from "../../modals Screen/Create Ep Request/create-ep-request-modal.component";

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
  
  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: any;
  
  // Preview
  showPreview = false;
  previewData: any = null;
  
  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  
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
    this.authService.getAllEPApprovalRequests().subscribe({
      next: (res: any) => {
        console.log('📥 EP Approval Response:', res);
        let data = [];
        if (res?.data && Array.isArray(res.data)) data = res.data;
        else if (Array.isArray(res)) data = res;
        else if (res?.requests && Array.isArray(res.requests)) data = res.requests;
        else if (res?.result && Array.isArray(res.result)) data = res.result;
        
        console.log('📊 Data to map:', data);
        
        this.allRequests = data
          .filter((r: any) => {
            const title = String(r.title || r.subject || r.titleOfActivity || '').trim();
            const requester = String(r.requester || r.requesterName || r.createdBy?.name || '').trim();
            return title && title.toLowerCase() !== 'nm' && requester;
          })
          .map((r: any) => this.mapRecord(r));
        console.log('✅ Mapped Requests:', this.allRequests);
        
        this.applyFilters();
        this.isLoading = false;
        this.showToast(`${this.allRequests.length} EP requests loaded`, 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('❌ Load error:', err);
        this.isLoading = false;
        // Load sample data for demo if API fails
        this.loadSampleData();
        this.showToast(err?.message || 'Failed to load EP requests, using sample data', 'error');
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
    const p = priority.toString().toUpperCase();
    if (p === 'H' || p === 'HIGH' || p === 'URGENT') return 'High';
    if (p === 'M' || p === 'MEDIUM') return 'Medium';
    if (p === 'L' || p === 'LOW') return 'Low';
    if (p === 'High' || p === 'Medium' || p === 'Low' || p === 'Urgent') return p as EPRequest['priority'];
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
      attachment.fileSize = this.formatFileSize(file.size);
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          attachment.preview = e.target.result;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      } else {
        attachment.preview = '📄 ' + (file.type.split('/')[1]?.toUpperCase() || 'FILE');
      }
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
    
    const approversHtml = this.approvers.filter(a => a.managerName).map((a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${a.line}</td>
        <td>${a.managerName}</td>
        <td>${a.designation}</td>
        <td>${a.email}</td>
        <td><span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;">${a.status}</span></td>
        <td>${a.dateTime || '—'}</td>
        <td>${a.remarks || '—'}</td>
      </tr>
    `).join('');
    
    const attachmentsHtml = this.attachments.filter(a => a.file).map((a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${a.name}</td>
        <td>${a.fileSize}</td>
        <td>${a.remark || '—'}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>EP Request Preview - ${this.formData.titleOfActivity}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f0f4f8;
            padding: 40px;
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #0f2a5e, #1e4a8a);
            color: white;
            padding: 30px;
          }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0; opacity: 0.8; }
          .content { padding: 30px; }
          .section {
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
          }
          .section-title {
            background: #f8fafc;
            padding: 12px 20px;
            font-weight: 700;
            color: #0f2a5e;
            border-bottom: 1px solid #e2e8f0;
          }
          .section-body { padding: 20px; }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .info-item label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            display: block;
            margin-bottom: 4px;
          }
          .info-item span {
            font-size: 14px;
            color: #0f172a;
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background: #f1f5f9;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid #e2e8f0;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
          }
          .amount {
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
          }
          .footer {
            background: #f8fafc;
            padding: 16px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          @media print {
            body { padding: 0; background: white; }
            .btn-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>EP Approval Request</h1>
            <p>Radiant Appliances - ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="content">
            <div class="section">
              <div class="section-title">📋 Requester Information</div>
              <div class="section-body">
                <div class="info-grid">
                  <div class="info-item"><label>Name</label><span>${this.formData.requesterName}</span></div>
                  <div class="info-item"><label>Department</label><span>${this.formData.department}</span></div>
                  <div class="info-item"><label>Email ID</label><span>${this.formData.emailId}</span></div>
                  <div class="info-item"><label>Contact No.</label><span>${this.formData.contactNo}</span></div>
                  <div class="info-item"><label>Organization</label><span>${this.formData.organization}</span></div>
                  <div class="info-item"><label>Request Date</label><span>${this.formData.requestDate}</span></div>
                </div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">🎯 Activity Overview</div>
              <div class="section-body">
                <div class="info-grid">
                  <div class="info-item"><label>Title of Activity</label><span>${this.formData.titleOfActivity}</span></div>
                  <div class="info-item"><label>Vendor / Supplier</label><span>${this.formData.vendor}</span></div>
                  <div class="info-item"><label>Amount / Cost</label><span class="amount">₹${this.formData.amount.toLocaleString('en-IN')}</span></div>
                  <div class="info-item"><label>Priority Level</label><span>${this.formData.priority}</span></div>
                </div>
                ${this.formData.description ? `<p style="margin-top:16px;"><strong>Description:</strong><br>${this.formData.description}</p>` : ''}
                ${this.formData.objective ? `<p style="margin-top:12px;"><strong>Objective:</strong><br>${this.formData.objective}</p>` : ''}
              </div>
            </div>
            
            ${approversHtml ? `
            <div class="section">
              <div class="section-title">👥 Approval Chain</div>
              <div class="section-body">
                <table>
                  <thead><tr><th>#</th><th>Line</th><th>Manager</th><th>Designation</th><th>Email</th><th>Status</th><th>Date/Time</th><th>Remarks</th></tr></thead>
                  <tbody>${approversHtml}</tbody>
                </table>
              </div>
            </div>
            ` : ''}
            
            ${attachmentsHtml ? `
            <div class="section">
              <div class="section-title">📎 Attachments</div>
              <div class="section-body">
                <table>
                  <thead><tr><th>S.No.</th><th>Attachment</th><th>File Size</th><th>Remark</th></tr></thead>
                  <tbody>${attachmentsHtml}</tbody>
                </table>
              </div>
            </div>
            ` : ''}
            
            ${this.ccList.length ? `
            <div class="section">
              <div class="section-title">📧 CC Recipients</div>
              <div class="section-body">
                <ul style="margin:0;padding-left:20px;">
                  ${this.ccList.map(cc => `<li>${cc}</li>`).join('')}
                </ul>
              </div>
            </div>
            ` : ''}
          </div>
          <div class="footer">
            This is a preview of your EP Request. Please verify all details before submitting.
          </div>
        </div>
        <div style="text-align:center; margin-top:20px;">
          <button onclick="window.print()" class="btn-print" style="padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ Print / Save as PDF</button>
        </div>
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