// wcc-npp.component.ts
import { Component, OnInit, Output, EventEmitter, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RatingItem {
  head: string;
  weight: number;
  rating: number;
  remark: string;
  na: boolean;
}

export interface Approver {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  line: 'Parallel' | 'Sequential';
  remarks: string;
  isFromApi: boolean;
}

export interface Certificate {
  id: string;
  serialNo: string;
  generatedAt: string;
  data: any;
}

@Component({
  selector: 'app-wcc-npp',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './wcc-npp.html',
  styleUrls: ['./wcc-npp.scss']
})
export class WccNppComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  private http = inject(HttpClient);

  // Form Data
  form = {
    requesterName: 'PIC NAME & DEPT.',
    poNo: '',
    vendorName: '',
    natureOfWork: 'Fabrication',
    workDescription: '',
    observations: ''
  };

  // Rating Parameters
  ratings: RatingItem[] = [
    { head: 'Work completed as per scope / BOD', weight: 25, rating: 0, remark: '', na: false },
    { head: 'Quality of workmanship / finishing', weight: 10, rating: 0, remark: '', na: false },
    { head: 'Compliance with approved materials specifications', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Compliance with safety practices (PPE, barricading, permits)', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Compliance with method statement / procedure', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Time adherence (planned vs actual)', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Site cleanliness & housekeeping during work', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Management of resources/tools & manpower', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Responsibilities & coordination', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Issue resolution / handling', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Material storage & handling', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Testing / inspection support', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Documentation submitted', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Statutory/regulatory compliance', weight: 5, rating: 0, remark: '', na: false },
    { head: 'Overall workmanship reliability', weight: 5, rating: 0, remark: '', na: false }
  ];

  // Acceptance Options
  finalDecision: string = 'Accept & close';
  acceptanceRemark: string = '';

  // Dynamic Approvers - From API
  availableApprovers: any[] = [];
  approvers: Approver[] = [];
  isLoadingApprovers: boolean = false;
  isSubmitting: boolean = false;

  // CC Recipients - Dynamic
  ccInput: string = '';
  ccRecipients: string[] = [];

  // Attachments - Dynamic
  attachments: { file: File; preview: string; name: string; size: number }[] = [];

  // Score
  overallScore: number = 0;

  // UI State
  showSuccessMessage: boolean = false;
  successMessage: string = '';
  submittedSerialNo: string = '';
  
  // Certificate
  showCertificateModal: boolean = false;
  certificateList: Certificate[] = [];
  isGeneratingCertificate: boolean = false;
  
  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: any;

  // Drafts
  savedDrafts: any[] = [];
  selectedDraftId: string = '';

  // Email Status
  emailSentStatus: { sent: boolean; message: string } | null = null;

  // Approval Records
  approvalRecords = [
    { approval: '', line: 'Sequential', stakeholder: 'Wijay Parashar', commentRemark: 'okay, urgent purpose', derogation: 'Head-Depth', status: 'Approval', dateTime: '2-23-26 9:30 AM' },
    { approval: '', line: '', stakeholder: 'Shailendra Chatha', commentRemark: 'OK', derogation: 'Head-Purchase', status: 'Approval', dateTime: '2-23-26 10:30 AM' },
    { approval: '', line: '', stakeholder: '', commentRemark: '', derogation: 'VP', status: 'Approval', dateTime: '2-23-26 2:30 PM' }
  ];

  constructor() {
    this.loadCertificates();
    this.loadDrafts();
  }

  ngOnInit() {
    this.fetchApprovers();
  }

  // ==================== API METHODS ====================
  async fetchApprovers() {
    this.isLoadingApprovers = true;
    try {
      // Your actual API endpoint - Replace with your backend URL
      const response = await firstValueFrom(
        this.http.get<any[]>('https://your-api.com/approvers')
      );
      this.availableApprovers = response;
      this.showToast('Approvers loaded successfully', 'success');
    } catch (error) {
      console.error('API Error:', error);
      // Demo data - Remove in production
      this.availableApprovers = [
        { id: '1', name: 'Dr. A P J Kalam', email: 'apj.kalam@lcgc.com', designation: 'Chief Scientific Advisor', department: 'Strategic Planning' },
        { id: '2', name: 'Ratan Tata', email: 'ratan.tata@lcgc.com', designation: 'Chairman Emeritus', department: 'Board' },
        { id: '3', name: 'Sundar Pichai', email: 'sundar.pichai@lcgc.com', designation: 'CEO - Technology', department: 'IT' },
        { id: '4', name: 'Indra Nooyi', email: 'indra.nooyi@lcgc.com', designation: 'Strategic Advisor', department: 'Strategy' },
        { id: '5', name: 'Wijay Parashar', email: 'wijay.parashar@lcgc.com', designation: 'Head - Depth', department: 'Engineering' },
        { id: '6', name: 'Shailendra Chatha', email: 'shailendra.chatha@lcgc.com', designation: 'Head - Purchase', department: 'Procurement' }
      ];
      this.showToast('Using demo data. Connect API for live data.', 'info');
    } finally {
      this.isLoadingApprovers = false;
    }
  }

  // ==================== APPROVER METHODS ====================
  addApprover() {
    const newId = Date.now().toString();
    this.approvers.push({
      id: newId,
      name: '',
      email: '',
      designation: '',
      department: '',
      line: 'Parallel',
      remarks: '',
      isFromApi: false
    });
  }

  removeApprover(id: string) {
    if (this.approvers.length > 1) {
      this.approvers = this.approvers.filter(a => a.id !== id);
      this.showToast('Approver removed', 'info');
    } else {
      this.showToast('At least one approver is required', 'error');
    }
  }

  onApproverSelect(approver: Approver, selectedName: string) {
    const selected = this.availableApprovers.find(a => a.name === selectedName);
    if (selected) {
      approver.name = selected.name;
      approver.email = selected.email;
      approver.designation = selected.designation;
      approver.department = selected.department;
      approver.isFromApi = true;
    }
  }

  // ==================== CC METHODS ====================
  addCcRecipients() {
    if (!this.ccInput.trim()) return;
    
    const emails = this.ccInput
      .split(/[ ,;\n]+/)
      .map(e => e.trim())
      .filter(e => e && e.includes('@') && !this.ccRecipients.includes(e));
    
    if (emails.length) {
      this.ccRecipients.push(...emails);
      this.ccInput = '';
      this.showToast(`${emails.length} email(s) added to CC`, 'success');
    } else {
      this.showToast('No valid emails found', 'error');
    }
  }

  removeCc(email: string) {
    this.ccRecipients = this.ccRecipients.filter(e => e !== email);
    this.showToast('Email removed from CC', 'info');
  }

  // ==================== ATTACHMENT METHODS ====================
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const attachment = {
          file: file,
          preview: '',
          name: file.name,
          size: file.size
        };
        
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            attachment.preview = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
        
        this.attachments.push(attachment);
      }
      this.showToast(`${input.files.length} file(s) attached`, 'success');
    }
    input.value = '';
  }

  removeAttachment(index: number) {
    this.attachments.splice(index, 1);
    this.showToast('Attachment removed', 'info');
  }

  // ==================== SCORE CALCULATION ====================
  calculateScore() {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    this.ratings.forEach(r => {
      if (!r.na) {
        totalWeightedScore += (r.rating * r.weight);
        totalWeight += r.weight;
      }
    });
    
    this.overallScore = totalWeight > 0 ? parseFloat((totalWeightedScore / totalWeight).toFixed(1)) : 0;
    return this.overallScore;
  }

  getScorePercentage(): number {
    return (this.overallScore / 5) * 100;
  }

  getScoreColor(): string {
    if (this.overallScore >= 4) return '#10b981';
    if (this.overallScore >= 3) return '#3b82f6';
    if (this.overallScore >= 2) return '#f59e0b';
    return '#ef4444';
  }

  getRatingLabel(): string {
    if (this.overallScore >= 4.5) return 'Excellent';
    if (this.overallScore >= 3.5) return 'Very Good';
    if (this.overallScore >= 2.5) return 'Good';
    if (this.overallScore >= 1.5) return 'Average';
    return 'Needs Improvement';
  }

  getRatingClass(rating: number): string {
    if (rating >= 4) return 'excellent';
    if (rating >= 3) return 'good';
    if (rating >= 2) return 'average';
    return 'poor';
  }

  // ==================== DRAFT METHODS ====================
  saveDraft() {
    const draft = {
      id: Date.now().toString(),
      name: `Draft - ${new Date().toLocaleString()}`,
      form: { ...this.form },
      ratings: this.ratings.map(r => ({ ...r })),
      approvers: this.approvers.map(a => ({ ...a })),
      ccRecipients: [...this.ccRecipients],
      finalDecision: this.finalDecision,
      acceptanceRemark: this.acceptanceRemark,
      savedAt: new Date().toISOString()
    };
    
    const drafts = JSON.parse(localStorage.getItem('wcc_drafts') || '[]');
    drafts.unshift(draft);
    localStorage.setItem('wcc_drafts', JSON.stringify(drafts.slice(0, 20)));
    this.loadDrafts();
    this.showToast('Draft saved successfully!', 'success');
  }

  loadDrafts() {
    this.savedDrafts = JSON.parse(localStorage.getItem('wcc_drafts') || '[]');
  }

  loadDraft() {
    if (!this.selectedDraftId) return;
    const draft = this.savedDrafts.find(d => d.id === this.selectedDraftId);
    if (draft) {
      this.form = { ...draft.form };
      this.ratings = draft.ratings.map((r: any) => ({ ...r }));
      this.approvers = draft.approvers.map((a: any) => ({ ...a }));
      this.ccRecipients = [...draft.ccRecipients];
      this.finalDecision = draft.finalDecision;
      this.acceptanceRemark = draft.acceptanceRemark;
      this.calculateScore();
      this.showToast('Draft loaded successfully!', 'success');
    }
  }

  // ==================== SUBMIT ====================
  submitForm() {
    if (!this.form.poNo?.trim()) { this.showToast('Please enter PO / WO Number', 'error'); return; }
    if (!this.form.vendorName?.trim()) { this.showToast('Please enter Vendor Name', 'error'); return; }
    if (!this.form.workDescription?.trim()) { this.showToast('Please enter Work Description', 'error'); return; }
    if (this.approvers.length === 0 || !this.approvers[0].name) { this.showToast('Please add at least one approver', 'error'); return; }

    this.isSubmitting = true;
    const serialNo = `WCC-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(Math.random()*10000)}`;
    this.submittedSerialNo = serialNo;
    this.calculateScore();

    setTimeout(() => {
      this.isSubmitting = false;
      this.showSuccessMessage = true;
      this.successMessage = `WCC submitted successfully! Serial No: ${serialNo}`;
      
      this.onSubmit.emit({ success: true, serialNo, data: { form: this.form, ratings: this.ratings, overallScore: this.overallScore, approvers: this.approvers, ccRecipients: this.ccRecipients } });

      setTimeout(() => { this.showSuccessMessage = false; }, 5000);
      this.showToast(`WCC submitted! Serial: ${serialNo}`, 'success');
      setTimeout(() => { this.openCertificateModal(); }, 1000);
    }, 2000);
  }

  resetForm() {
    this.form = { requesterName: 'PIC NAME & DEPT.', poNo: '', vendorName: '', natureOfWork: 'Fabrication', workDescription: '', observations: '' };
    this.ratings.forEach(r => { r.rating = 0; r.remark = ''; r.na = false; });
    this.approvers = [];
    this.ccRecipients = [];
    this.attachments = [];
    this.overallScore = 0;
    this.finalDecision = 'Accept & close';
    this.acceptanceRemark = '';
    this.showToast('Form reset', 'info');
  }

  // ==================== CERTIFICATE METHODS ====================
  openCertificateModal() { this.showCertificateModal = true; this.loadCertificates(); }
  closeCertificateModal() { this.showCertificateModal = false; }

  loadCertificates() {
    this.certificateList = JSON.parse(localStorage.getItem('wcc_certificates') || '[]');
  }

  generateCertificate() {
    this.isGeneratingCertificate = true;
    
    setTimeout(() => {
      const certificate: Certificate = {
        id: 'cert_' + Date.now(),
        serialNo: this.submittedSerialNo,
        generatedAt: new Date().toISOString(),
        data: {
          poNo: this.form.poNo,
          vendorName: this.form.vendorName,
          natureOfWork: this.form.natureOfWork,
          workDescription: this.form.workDescription,
          overallScore: this.overallScore,
          ratingLabel: this.getRatingLabel(),
          ratings: this.ratings,
          finalDecision: this.finalDecision,
          approvers: this.approvers,
          ccRecipients: this.ccRecipients
        }
      };

      const certs = JSON.parse(localStorage.getItem('wcc_certificates') || '[]');
      certs.unshift(certificate);
      localStorage.setItem('wcc_certificates', JSON.stringify(certs.slice(0, 20)));
      this.certificateList = certs;
      
      this.isGeneratingCertificate = false;
      this.showToast('Certificate generated!', 'success');
      this.sendEmailNotifications(certificate);
      this.previewCertificate(certificate);
    }, 2000);
  }

  sendEmailNotifications(certificate: Certificate) {
    const toEmails = this.approvers.map(a => a.email).filter(e => e);
    const allEmails = [...toEmails, ...this.ccRecipients];
    
    console.log('📧 Email Sent:', {
      to: toEmails,
      cc: this.ccRecipients,
      certificate: certificate.serialNo,
      subject: `Work Completion Certificate - ${certificate.serialNo}`
    });
    
    this.emailSentStatus = { sent: true, message: `Sent to ${allEmails.length} recipient(s)` };
    setTimeout(() => { this.emailSentStatus = null; }, 5000);
  }

  previewCertificate(cert: Certificate) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(this.generateCertificateHTML(cert));
      win.document.close();
    }
  }

  downloadCertificate(cert: Certificate) {
    const blob = new Blob([this.generateCertificateHTML(cert)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WCC_${cert.serialNo}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  generateCertificateHTML(cert: Certificate): string {
    const data = cert.data;
    return `<!DOCTYPE html>
    <html>
    <head><title>WCC - ${cert.serialNo}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',system-ui; background:#f0f4f8; padding:40px; }
      .cert { max-width:1000px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.1); }
      .header { background:linear-gradient(135deg,#0f2a5e,#1e4a8a); color:white; padding:30px; text-align:center; }
      .header h1 { font-size:28px; }
      .body { padding:30px; }
      .serial { background:#f1f5f9; padding:12px; border-radius:10px; text-align:center; margin-bottom:20px; font-family:monospace; }
      .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:15px; margin-bottom:20px; }
      .card { background:#f8fafc; padding:15px; border-radius:10px; }
      .card label { font-size:11px; color:#64748b; text-transform:uppercase; }
      .card div { font-weight:600; margin-top:5px; }
      .score { background:#f0fdf4; text-align:center; padding:20px; border-radius:10px; margin:20px 0; }
      .score-value { font-size:36px; font-weight:800; color:#0f2a5e; }
      table { width:100%; border-collapse:collapse; margin:20px 0; }
      th,td { padding:10px; border-bottom:1px solid #e2e8f0; text-align:left; }
      th { background:#f1f5f9; }
      .footer { background:#f8fafc; padding:15px; text-align:center; font-size:12px; color:#64748b; }
      @media print { body { padding:0; } .no-print { display:none; } }
    </style>
    </head>
    <body>
      <div class="cert">
        <div class="header"><h1>WORK COMPLETION CERTIFICATE</h1><p>LCGC Resolute Group</p></div>
        <div class="body">
          <div class="serial">Certificate No: ${cert.serialNo}</div>
          <div class="grid">
            <div class="card"><label>PO / WO No</label><div>${data.poNo}</div></div>
            <div class="card"><label>Vendor Name</label><div>${data.vendorName}</div></div>
            <div class="card"><label>Nature of Work</label><div>${data.natureOfWork}</div></div>
            <div class="card"><label>Work Description</label><div>${data.workDescription}</div></div>
          </div>
          <div class="score"><div class="score-value">${data.overallScore} / 5</div><div>${data.ratingLabel}</div></div>
          <table><thead><tr><th>Parameter</th><th>Weight</th><th>Rating</th><th>Remark</th></tr></thead>
          <tbody>${data.ratings.map((r: any) => `<tr><td>${r.head}</td><td>${r.weight}%</td><td>${r.na ? 'N/A' : r.rating}</td><td>${r.remark || '—'}</td></tr>`).join('')}</tbody>
          </table>
          <div class="footer">This is a system-generated certificate</div>
        </div>
      </div>
      <div class="no-print" style="text-align:center;margin-top:20px;"><button onclick="window.print()" style="background:#0f2a5e;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">🖨️ Print</button></div>
    </body>
    </html>`;
  }

  // ==================== UTILITIES ====================
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  showToast(message: string, type: 'success' | 'error' | 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => { this.toast = null; }, 4000);
  }
}