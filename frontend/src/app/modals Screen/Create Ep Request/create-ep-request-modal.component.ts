import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface Approver {
  id?: number;
  line: 'Parallel' | 'Sequential';
  managerName: string;
  email: string;
  designation: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In-Process';
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
  _id?: string;          // MongoDB document id
  id: string;
  requestId: string;
  title: string;
  requester: string;
  department: string;
  status: string;
  date: string;
  priority: string;
  amount: number;
  email?: string;
  createdAt?: string;
  stakeholders?: any[];
  canApprove?: boolean;
  approvalComments?: string;
  queryAssignedTo?: string;
}

@Component({
  selector: 'app-create-ep-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-ep-request.html',
  styleUrls: ['./create-ep-request.scss']
})
export class CreateEPRequestModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  // View states
  showListView: boolean = true;
  showFormView: boolean = false;
  showSuccessView: boolean = false;
  showDetailModal: boolean = false;
  isViewMode: boolean = false;
  isLoading: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast: boolean = false;
  selectedRequest: EPRequest | null = null;

  // Approval action
  actionRemarks: string = '';
  isActioning: boolean = false;

  // Form Data
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

  // Approval Chain
  approvers: Approver[] = [
    {
      id: 1,
      line: 'Parallel',
      managerName: '',
      email: '',
      designation: '',
      status: 'Pending',
      dateTime: '',
      remarks: '',
      contactNo: '',
      organization: ''
    }
  ];

  // Attachments
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

  // All Requests
  allRequests: EPRequest[] = [];

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

  isSubmitting = false;
  showPreview = false;
  previewData: any = null;
  private toastTimer: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  Math = Math;
  showMediaModal = false;
  mediaPreviewUrl = '';
  mediaPreviewTitle = '';
  mediaZoomScale = 1;
  isPdfMedia = false;
  isImageMedia = false;
  sanitizedMediaUrl: SafeResourceUrl | null = null;

  openMediaPreview(attachmentOrUrl: any, title?: string) {
    if (!attachmentOrUrl) {
      this.showToastMessage('Please upload a file first to view preview.', 'info');
      return;
    }
    
    let url = typeof attachmentOrUrl === 'string' ? attachmentOrUrl : (attachmentOrUrl.fileUrl || attachmentOrUrl.url || attachmentOrUrl.preview || attachmentOrUrl.data || attachmentOrUrl.fileData || '');
    const name = title || (typeof attachmentOrUrl === 'object' ? attachmentOrUrl.name || (attachmentOrUrl as any).fileName : '') || 'Attachment Preview';
    
    if (url && !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      if (url.startsWith('/')) {
        url = `https://lcgc-rfq.onrender.com${url}`;
      } else {
        url = `https://lcgc-rfq.onrender.com/${url}`;
      }
    }

    if (!url || (!url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('blob:'))) {
      this.showToastMessage('Please upload a valid PDF or image file first to view preview.', 'info');
      return;
    }

    this.mediaPreviewTitle = name;
    this.mediaZoomScale = 1;

    const lowerUrl = url.toLowerCase();
    this.isImageMedia = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(lowerUrl);
    this.isPdfMedia = url.startsWith('data:application/pdf') || lowerUrl.includes('.pdf') || url.startsWith('blob:');

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
    this.sanitizedMediaUrl = null;
  }

  // Approver Detail Modal
  showApproverModal = false;
  selectedApproverDetail: any = null;

  openApproverDetail(approver: any) {
    this.selectedApproverDetail = approver;
    this.showApproverModal = true;
    this.cdr.detectChanges();
  }

  closeApproverModal() {
    this.showApproverModal = false;
    this.selectedApproverDetail = null;
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

  getSanitizedUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url || '');
  }



  ngOnInit() {
    this.initializeForm();
    this.loadRequestsFromStorage();
    this.loadManagerOptions();
    this.showListView = true;
    this.showFormView = false;
    this.showSuccessView = false;
  }

  private initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    
    this.formData = {
      requesterName: this.authService.getUser()?.name || 'Deepak Kumar',
      department: this.authService.getUser()?.department || 'IT',
      emailId: this.authService.getUser()?.email || 'dk897869@gmail.com',
      requestDate: today,
      contactNo: this.authService.getUser()?.contactNo || '6239785524',
      organization: 'Radiant Appliances',
      titleOfActivity: '',
      vendor: '',
      amount: 0,
      priority: 'High',
      description: '',
      objective: '',
      ccList: []
    };
  }

  // Load requests from API (real backend)
  loadRequestsFromStorage() {
    this.isLoading = true;
    this.authService.getAllEPApprovalRequests().subscribe({
      next: (res: any) => {
        const list = res?.data || res?.requests || (Array.isArray(res) ? res : []);
        this.allRequests = list.map((item: any) => ({
          _id: item._id || item.id,
          id: item._id || item.id,
          requestId: item.uniqueSerialNo || item.requestId || item._id || 'EP-' + String(item._id).slice(-6),
          title: item.title || item.titleOfActivity || 'Untitled',
          requester: item.requester || item.requesterName || item.createdByName || '',
          department: item.department || '',
          status: item.status || 'Pending',
          date: item.requestDate || item.createdAt || '',
          priority: item.priority || 'Medium',
          amount: Number(item.amount || 0),
          email: item.email || item.emailId || ''
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        // Fallback to localStorage if API fails
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem('ep_approval_requests');
          if (saved) {
            try { this.allRequests = JSON.parse(saved); } catch {}
          }
        }
        this.cdr.detectChanges();
      }
    });
  }

  saveRequestsToStorage() {
    // No longer saving to localStorage — data lives in backend
  }

  private loadManagerOptions() {
    this.authService.getManagers().subscribe({
      next: (res: any) => {
        const list = res?.managers || res?.defaultApprovers || [];
        if (Array.isArray(list) && list.length) this.managerOptions = list;
      },
      error: () => {}
    });
  }

  // Navigation methods
  showListViewScreen() {
    this.showListView = true;
    this.showFormView = false;
    this.showSuccessView = false;
    this.showDetailModal = false;
    this.isViewMode = false;
    this.selectedRequest = null;
    this.actionRemarks = '';
    this.loadRequestsFromStorage();
  }

  showFormScreen() {
    this.showListView = false;
    this.showFormView = true;
    this.showSuccessView = false;
    this.showDetailModal = false;
    this.isViewMode = false;
    this.initializeForm();
  }

  showSuccessScreen() {
    this.showListView = false;
    this.showFormView = false;
    this.showSuccessView = true;
    this.showDetailModal = false;
  }

  // Toast methods
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
    }, 200);
  }

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    
    setTimeout(() => {
      this.showToast = false;
    }, 2000);
  }

  closeToast() {
    this.showToast = false;
  }

  // ====================== APPROVAL CHAIN METHODS ======================
  
  addApprover() {
    const newId = Math.max(...this.approvers.map(a => a.id || 0), 0) + 1;
    this.approvers.push({
      id: newId,
      line: 'Parallel',
      managerName: '',
      email: '',
      designation: '',
      status: 'Pending',
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

  onManagerLookup(approver: Approver, value: string) {
    const term = (value || '').trim().toLowerCase();
    const manager = this.managerOptions.find(m =>
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

  // ====================== ATTACHMENT METHODS ======================
  
  onFileSelected(attachment: Attachment, event: any) {
    const file = event.target.files[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showToastMessage('File size exceeds 5MB limit', 'error');
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

  // ====================== CC METHODS ======================
  
  addCc() {
    const email = this.ccInput.trim();
    if (email && this.validateEmail(email) && !this.ccList.includes(email)) {
      this.ccList.push(email);
      this.ccInput = '';
      this.formData.ccList = this.ccList;
    } else if (email && !this.validateEmail(email)) {
      this.showToastMessage('Invalid email format', 'error');
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

  // ====================== PREVIEW PDF ======================
  
  previewPDF() {
    if (!this.validateForm()) return;
    
    this.previewData = {
      ...this.formData,
      approvers: this.approvers.filter(a => a.managerName),
      attachments: this.attachments.filter(a => a.file),
      ccList: this.ccList
    };
    
    this.showPreview = true;
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
          <td style="padding:8px; border:1px solid #cbd5e1; font-weight:600; color:#0f172a;">${a.managerName}</td>
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
          <td colspan="2" style="padding:8px; border:1px solid #cbd5e1;">${a.name}</td>
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
        <title>EP Request Preview - ${this.formData.titleOfActivity}</title>
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
              <td colspan="2" class="val" style="font-weight:700;">${this.formData.requesterName}</td>
              <th class="label">Request Date</th>
              <td colspan="2" class="val">${this.formData.requestDate}</td>
            </tr>
            <tr>
              <th class="label">Department</th>
              <td colspan="2" class="val">${this.formData.department}</td>
              <th class="label">Contact No.</th>
              <td colspan="2" class="val">${this.formData.contactNo || '—'}</td>
            </tr>
            <tr>
              <th class="label">Email ID</th>
              <td colspan="2" class="val"><a href="mailto:${this.formData.emailId}" style="color:#2563eb;">${this.formData.emailId}</a></td>
              <th class="label">Organization</th>
              <td colspan="2" class="val">${this.formData.organization}</td>
            </tr>

            <!-- Activity Overview -->
            <tr>
              <th class="section-label">Activity Overview</th>
              <th class="label" colspan="1">Title of Activity</th>
              <td colspan="2" class="val" style="font-weight:600;">${this.formData.titleOfActivity}</td>
              <th class="label">Priority</th>
              <td colspan="2" class="val">${this.formData.priority}</td>
            </tr>

            <!-- Description -->
            <tr>
              <th class="section-label">Description</th>
              <td colspan="6" style="padding: 16px; white-space: pre-wrap; vertical-align: top; line-height: 1.5; min-height: 120px;">${this.formData.description || this.formData.objective || ''}</td>
            </tr>

            <!-- Approval Chain Header -->
            ${activeApprovers.length > 0 ? `
            <tr>
              <th rowspan="${activeApprovers.length + 1}" class="section-label">Approval</th>
              <th class="label">Line</th>
              <th class="label">Stakeholder</th>
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
              <th colspan="2" class="label">Attachment</th>
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

  closePreview() {
    this.showPreview = false;
    this.previewData = null;
  }

  // ====================== FORM VALIDATION ======================
  
  private validateForm(): boolean {
    if (!this.formData.titleOfActivity?.trim()) {
      this.showToastMessage('Title of Activity is required', 'error');
      return false;
    }
    const validApprovers = this.approvers.filter(a => a.managerName);
    if (validApprovers.length === 0) {
      this.showToastMessage('At least one approver is required', 'error');
      return false;
    }
    return true;
  }

  // ====================== SUBMIT ======================
  
  onSubmit() {
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    this.showToastMessage('Submitting EP request...', 'info');

    const payload = {
      title: this.formData.titleOfActivity,
      requester: this.formData.requesterName,
      department: this.formData.department,
      email: this.formData.emailId,
      requestDate: this.formData.requestDate,
      contactNo: this.formData.contactNo,
      organization: this.formData.organization,
      description: this.formData.description,
      priority: this.formData.priority,  // ✅ Fixed: include priority in submission
      vendor: this.formData.vendor,
      amount: this.formData.amount,
      objective: this.formData.objective,
      status: 'Pending',
      stakeholders: this.approvers
        .filter(a => a.managerName && a.email)
        .map((a, idx) => ({
          name: a.managerName,
          email: a.email,
          designation: a.designation || '',
          line: a.line,
          approvalOrder: idx + 1,
          status: a.status,
          remarks: a.remarks || ''
        })),
      attachments: this.attachments
        .filter(a => a.file)
        .map(a => ({ name: a.name, fileSize: a.fileSize, remark: a.remark })),
      ccList: this.ccList
    };

    this.authService.createEPRequest(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        const createdId = res?.data?.uniqueSerialNo || res?.data?._id || res?.requestId || 'EP-' + Date.now();
        this.showToastMessage(`EP Request ${createdId} submitted successfully!`, 'success');
        setTimeout(() => {
          this.loadRequestsFromStorage(); // Refresh from API
          this.showListViewScreen();
          this.resetForm();
        }, 2000);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToastMessage(err?.message || 'Failed to submit EP request. Please try again.', 'error');
      }
    });
  }

  resetForm() {
    this.formData.titleOfActivity = '';
    this.formData.vendor = '';
    this.formData.amount = 0;
    this.formData.description = '';
    this.formData.objective = '';
    this.formData.priority = 'High';
    this.approvers = [
      {
        id: 1,
        line: 'Parallel',
        managerName: '',
        email: '',
        designation: '',
        status: 'Pending',
        dateTime: '',
        remarks: ''
      }
    ];
    this.attachments = [
      { id: 1, name: 'Attachment 1', fileSize: '', file: null, preview: '', remark: '' },
      { id: 2, name: 'Attachment 2', fileSize: '', file: null, preview: '', remark: '' },
      { id: 3, name: 'Attachment 3', fileSize: '', file: null, preview: '', remark: '' }
    ];
    this.ccList = [];
    this.ccInput = '';
    this.isSubmitting = false;
  }

  saveDraft() {
    const payload = {
      ...this.formData,
      approvers: this.approvers,
      attachments: this.attachments.map(a => ({
        id: a.id,
        name: a.name,
        fileSize: a.fileSize,
        fileName: a.file?.name || '',
        remark: a.remark
      })),
      ccList: this.ccList,
      status: 'Draft',
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(`ep_request_draft_${Date.now()}`, JSON.stringify(payload));
      this.showToastMessage('EP request saved as draft.', 'success');
    } catch {
      this.showToastMessage('Unable to save draft locally.', 'error');
    }
  }

  // View request - opens full page detail view
  viewRequest(request: EPRequest) {
    this.selectedRequest = { ...request };
    this.isViewMode = true;
    this.showListView = false;
    this.showFormView = true;
    this.showSuccessView = false;
    this.showDetailModal = false;
    this.actionRemarks = '';

    const mongoId = request._id || request.id || request.requestId;
    if (mongoId) {
      this.authService.getEPRequestFullDetails(mongoId).subscribe({
        next: (res: any) => {
          if (res?.data || res?.request) {
            const full = res.data || res.request;
            let canApprove = false;
            const stakeholders = full.approvalChain || full.stakeholders || (this.selectedRequest as any)?.stakeholders || [];
            if (stakeholders && Array.isArray(stakeholders)) {
              const pending = stakeholders.filter((s: any) => s.status === 'Pending');
              if (pending.length > 0) {
                const currentUser = this.authService.getCurrentUser();
                canApprove = pending[0].email === currentUser?.email || pending[0].name === currentUser?.name;
              }
            }

            this.selectedRequest = {
              ...this.selectedRequest,
              ...full,
              id: full._id || full.id || this.selectedRequest?.id,
              requestId: full.uniqueSerialNo || full.requestId || this.selectedRequest?.requestId,
              title: full.titleOfActivity || full.title || this.selectedRequest?.title,
              description: full.purposeAndObjective || full.description || (this.selectedRequest as any)?.description,
              objective: full.objective || (this.selectedRequest as any)?.objective,
              vendor: full.vendorName || full.vendor || (this.selectedRequest as any)?.vendor,
              amount: full.estimatedAmount || full.amount || this.selectedRequest?.amount,
              priority: full.priority || this.selectedRequest?.priority,
              department: full.department || this.selectedRequest?.department,
              requester: full.requesterName || full.requester || this.selectedRequest?.requester,
              email: full.emailId || full.email || (this.selectedRequest as any)?.email,
              contactNo: full.contactNo || (this.selectedRequest as any)?.contactNo,
              organization: full.organization || (this.selectedRequest as any)?.organization,
              attachments: full.attachments || (this.selectedRequest as any)?.attachments || [],
              ccList: full.ccList || (this.selectedRequest as any)?.ccList || [],
              stakeholders: stakeholders,
              canApprove: canApprove
            };
            this.cdr.detectChanges();
          }
        }
      });
    }
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedRequest = null;
  }

  approveRequest() {
    if (!this.selectedRequest) return;
    const mongoId = this.selectedRequest._id || this.selectedRequest.id;
    if (!mongoId) {
      this.showToastMessage('Cannot identify request. Please refresh and try again.', 'error');
      return;
    }
    this.isActioning = true;
    this.authService.approveEPRequest(mongoId, this.actionRemarks).subscribe({
      next: (res: any) => {
        this.isActioning = false;
        this.showToastMessage(
          res?.message || `Request approved successfully!`, 'success'
        );
        setTimeout(() => {
          this.loadRequestsFromStorage(); // Refresh list from API
          this.showListViewScreen();
        }, 2000);
      },
      error: (err: any) => {
        this.isActioning = false;
        this.showToastMessage(err?.message || 'Failed to approve request. Please try again.', 'error');
      }
    });
  }

  rejectRequest() {
    if (!this.selectedRequest) return;
    if (!this.actionRemarks.trim()) {
      this.showToastMessage('Please enter remarks before rejecting.', 'error');
      return;
    }
    const mongoId = this.selectedRequest._id || this.selectedRequest.id;
    if (!mongoId) {
      this.showToastMessage('Cannot identify request. Please refresh and try again.', 'error');
      return;
    }
    this.isActioning = true;
    this.authService.rejectEPRequest(mongoId, this.actionRemarks).subscribe({
      next: (res: any) => {
        this.isActioning = false;
        this.showToastMessage(
          res?.message || `Request rejected.`, 'info'
        );
        setTimeout(() => {
          this.loadRequestsFromStorage(); // Refresh list from API
          this.showListViewScreen();
        }, 2000);
      },
      error: (err: any) => {
        this.isActioning = false;
        this.showToastMessage(err?.message || 'Failed to reject request. Please try again.', 'error');
      }
    });
  }

  // Helper methods
  getPriorityLabel(priority: string): string {
    return priority || 'Medium';
  }

  getPriorityClass(priority: string): string {
    const map: any = { 'High': 'high', 'Medium': 'medium', 'Low': 'low', 'Urgent': 'urgent' };
    return map[priority] || 'medium';
  }

  getStatusClass(status: string): string {
    const map: any = { 'Approved': 'approved', 'Pending': 'pending', 'Rejected': 'rejected' };
    return map[status] || 'pending';
  }

  getTotalRequests(): number {
    return this.allRequests.length;
  }

  refreshData() {
    this.isLoading = true;
    this.showToastMessage('Refreshing data...', 'info');
    
    setTimeout(() => {
      this.isLoading = false;
      this.loadRequestsFromStorage();
      this.showToastMessage(`${this.getTotalRequests()} request(s) found`, 'success');
    }, 1000);
  }

  checkStatus() {
    this.showToastMessage(`Total ${this.getTotalRequests()} EP request(s) found`, 'info');
  }

  isPurchaseHeadOrAdmin(): boolean {
    const user = this.authService.getUser();
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    const dept = String(user.department || '').toLowerCase();
    const desig = String(user.designation || '').toLowerCase();
    return role === 'admin' || role === 'purchase' || dept.includes('purchase') || desig.includes('purchase') || desig.includes('head');
  }

  // Edit request - opens full form pre-filled with selected request data
  editRequest() {
    if (!this.selectedRequest) return;
    // Pre-fill form with selected request data
    this.formData.titleOfActivity = this.selectedRequest.title || '';
    this.formData.requesterName   = this.selectedRequest.requester || '';
    this.formData.department      = this.selectedRequest.department || '';
    this.formData.requestDate     = this.selectedRequest.date || new Date().toISOString().split('T')[0];
    this.formData.description     = '';
    // Switch to edit/create form mode
    this.isViewMode = false;
    this.showListView = false;
    this.showFormView = true;
    this.showSuccessView = false;
    this.showToastMessage('Form is now editable. Submit to update the request.', 'info');
  }

  // === View Mode Approver Actions ===

  addApproverInView() {
    if (!this.selectedRequest) return;
    if (!this.selectedRequest.stakeholders) this.selectedRequest.stakeholders = [];
    this.selectedRequest.stakeholders.push({
      name: '',
      email: '',
      designation: 'Admin',
      organization: 'Radiant Appliances',
      status: 'Pending',
      line: 'Parallel',
      isNew: true
    });
    this.showToastMessage('Approver row added.', 'success');
  }

  deleteApproverInView(idx: number) {
    if (!this.selectedRequest || !this.selectedRequest.stakeholders) return;
    this.selectedRequest.stakeholders.splice(idx, 1);
    this.showToastMessage('Approver removed.', 'info');
  }

  approveFromViewModal(req: any) {
    if (!req) return;
    // Mock approval or wire to actual backend
    this.showToastMessage('Action recorded: Approved', 'success');
    // Implement API call here...
  }

  rejectFromViewModal(req: any) {
    if (!req) return;
    this.showToastMessage('Action recorded: Rejected', 'error');
  }

  queryFromViewModal(req: any) {
    if (!req) return;
    this.showToastMessage('Action recorded: Query sent', 'info');
  }

  getLineRowspan(stakeholders: any[], currentIndex: number): number {
    if (!stakeholders || stakeholders.length === 0) return 0;
    const current = stakeholders[currentIndex];
    const currentLine = current.line || 'Parallel';
    
    if (currentIndex > 0) {
      const prev = stakeholders[currentIndex - 1];
      const prevLine = prev.line || 'Parallel';
      // If lines match AND they are both not new (or both new), they can merge.
      // Actually, if current is new and prev is not, break merge.
      if (prevLine === currentLine && prev.isNew === current.isNew) {
        return 0; // Hide this cell, it's merged with the previous one
      }
    }
    
    let rowspan = 1;
    for (let i = currentIndex + 1; i < stakeholders.length; i++) {
      const next = stakeholders[i];
      const nextLine = next.line || 'Parallel';
      if (nextLine === currentLine && next.isNew === current.isNew) {
        rowspan++;
      } else {
        break;
      }
    }
    return rowspan;
  }

  getApprovalChainSerials(approversList: any[]): number[] {
    if (!approversList || !approversList.length) return [];
    const serials: number[] = [];
    let currentSerial = 1;
    let inParallelBlock = false;
    
    for (let i = 0; i < approversList.length; i++) {
      const app = approversList[i];
      const rawLine = app.line || app.lineMode || app.approvalType || 'Parallel';
      const lineVal = String(rawLine).trim().toLowerCase();
      
      if (lineVal === 'parallel') {
        if (!inParallelBlock) {
          if (i > 0) {
            currentSerial++;
          }
          inParallelBlock = true;
        }
        serials.push(currentSerial);
      } else {
        if (i > 0) {
          currentSerial++;
        }
        inParallelBlock = false;
        serials.push(currentSerial);
      }
    }
    return serials;
  }

  getGroupRowClass(list: any[], index: number): string {
    if (!list || !list.length) return '';
    const serials = this.getApprovalChainSerials(list);
    const cur = serials[index];
    const prev = index > 0 ? serials[index - 1] : null;
    const next = index < list.length - 1 ? serials[index + 1] : null;

    if (cur === prev && cur === next) return 'group-row-middle';
    if (cur === next && cur !== prev) return 'group-row-start';
    if (cur === prev && cur !== next) return 'group-row-end';
    return 'group-row-single';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
  }
}