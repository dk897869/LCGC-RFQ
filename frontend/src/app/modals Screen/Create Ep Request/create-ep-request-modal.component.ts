import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Approver {
  id?: number;
  line: 'Parallel' | 'Sequential';
  managerName: string;
  email: string;
  designation: string;
  status: 'pending' | 'approved' | 'rejected' | 'waiting';
  dateTime: string;
  remarks: string;
}

interface Attachment {
  id?: number;
  name: string;
  fileSize: string;
  file: File | null;
  preview: string;
  remark: string;
}

@Component({
  selector: 'app-create-ep-request-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-ep-request.html',
  styleUrls: ['./create-ep-request.scss']
})
export class CreateEPRequestModalComponent implements OnInit {
  @Input() currentUser: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

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
      status: 'pending',
      dateTime: '',
      remarks: ''
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

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    
    this.formData = {
      requesterName: this.currentUser?.name || 'Deepak Kumar',
      department: this.currentUser?.department || 'IT',
      emailId: this.currentUser?.email || 'dk897869@gmail.com',
      requestDate: today,
      contactNo: this.currentUser?.contactNo || '6239785524',
      organization: this.currentUser?.organization || 'Updated Org',
      titleOfActivity: '',
      vendor: '',
      amount: 0,
      priority: 'High',
      description: '',
      objective: '',
      ccList: []
    };
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
      status: 'pending',
      dateTime: '',
      remarks: ''
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
    // Update date/time when manager is selected
    if (approver.managerName) {
      approver.dateTime = new Date().toLocaleString();
    }
  }

  // ====================== ATTACHMENT METHODS ======================
  
  onFileSelected(attachment: Attachment, event: any) {
    const file = event.target.files[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.showToast('File size exceeds 5MB limit', 'error');
        return;
      }
      
      attachment.file = file;
      attachment.fileSize = this.formatFileSize(file.size);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          attachment.preview = e.target.result;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      } else {
        attachment.preview = '📄 ' + file.type.split('/')[1]?.toUpperCase() || 'FILE';
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

  // ====================== CC METHODS ======================
  
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
            max-width: 900px;
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

  closePreview() {
    this.showPreview = false;
    this.previewData = null;
  }

  // ====================== DOWNLOAD EXCEL ======================
  
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

  // ====================== FORM VALIDATION ======================
  
  private validateForm(): boolean {
    if (!this.formData.titleOfActivity?.trim()) {
      this.showToast('Title of Activity is required', 'error');
      return false;
    }
    if (!this.formData.vendor?.trim()) {
      this.showToast('Vendor/Supplier is required', 'error');
      return false;
    }
    if (!this.formData.amount || this.formData.amount <= 0) {
      this.showToast('Valid amount is required', 'error');
      return false;
    }
    
    const validApprovers = this.approvers.filter(a => a.managerName);
    if (validApprovers.length === 0) {
      this.showToast('At least one approver is required', 'error');
      return false;
    }
    
    return true;
  }

  // ====================== SUBMIT ======================
  
  onSubmit() {
    if (!this.validateForm()) return;
    
    this.isSubmitting = true;
    
    const payload = {
      ...this.formData,
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
      ccList: this.ccList,
      status: 'Pending'
    };
    
    this.save.emit(payload);
  }

  // ====================== TOAST ======================
  
  showToast(message: string, type: 'success' | 'error' | 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  closeToast() {
    this.toast = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  closeModal() {
    this.close.emit();
  }
}