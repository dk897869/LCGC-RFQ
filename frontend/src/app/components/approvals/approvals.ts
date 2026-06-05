import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, timeout, finalize } from 'rxjs/operators';

interface ApprovalRequest {
  id: string;
  type: 'ep' | 'rfq' | 'npp' | 'pr' | 'po' | 'payment' | 'wcc' | 'comparison';
  serialNo: string;
  title: string;
  requester: string;
  email: string;
  department: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected' | 'In-Process';
  amount: number;
  requestDate: string;
  vendor?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  inProcess: number;
  byType: {
    ep: { total: number; pending: number; approved: number; rejected: number };
    rfq: { total: number; pending: number; approved: number; rejected: number };
    npp: { total: number; pending: number; approved: number; rejected: number };
    pr: { total: number; pending: number; approved: number; rejected: number };
    po: { total: number; pending: number; approved: number; rejected: number };
      payment: { total: number; pending: number; approved: number; rejected: number };
      wcc: { total: number; pending: number; approved: number; rejected: number };
      comparison: { total: number; pending: number; approved: number; rejected: number };
  };
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  icon: string;
}

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approvals.html',
  styleUrls: ['./approvals.scss']
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  // Active tab
  activeTab: 'all' | 'pending' | 'approved' | 'rejected' | 'in-process' = 'pending';
  
  // Filters
  searchTerm: string = '';
  typeFilter: string = 'all';
  priorityFilter: string = 'all';
  selectedRequest: ApprovalRequest | null = null;
  
  // Data
  allRequests: ApprovalRequest[] = [];
  filteredRequests: ApprovalRequest[] = [];
  approvalStats: ApprovalStats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    inProcess: 0,
    byType: {
      ep: { total: 0, pending: 0, approved: 0, rejected: 0 },
      rfq: { total: 0, pending: 0, approved: 0, rejected: 0 },
      npp: { total: 0, pending: 0, approved: 0, rejected: 0 },
      pr: { total: 0, pending: 0, approved: 0, rejected: 0 },
      po: { total: 0, pending: 0, approved: 0, rejected: 0 },
      payment: { total: 0, pending: 0, approved: 0, rejected: 0 },
      wcc: { total: 0, pending: 0, approved: 0, rejected: 0 },
      comparison: { total: 0, pending: 0, approved: 0, rejected: 0 }
    }
  };
  
  // UI State
  isLoading: boolean = false;
  showDetailsModal: boolean = false;
  showApproveModal: boolean = false;
  showRejectModal: boolean = false;
  approvalComments: string = '';
  rejectionReason: string = '';
  isSubmitting: boolean = false;
  
  toasts: Toast[] = [];
  private toastIdCounter = 0;
  private refreshInterval: any;
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.loadApprovals();
    this.startAutoRefresh();
  }
  
  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
  
  startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.loadApprovals(true); // Silent refresh
    }, 30000); // Refresh every 30 seconds
  }
  
  loadApprovals(silent: boolean = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    
    forkJoin({
      ep: this.authService.getAllEPApprovalRequests().pipe(timeout(10000), catchError(() => of([]))),
      rfq: this.authService.getRFQs().pipe(timeout(10000), catchError(() => of([]))),
      npp: this.authService.getNppRequests().pipe(timeout(10000), catchError(() => of([]))),
      pr: this.authService.getPrNppRequests().pipe(timeout(10000), catchError(() => of([]))),
      po: this.authService.getPoNppRequests().pipe(timeout(10000), catchError(() => of([]))),
      payment: this.authService.getPaymentNppRequests().pipe(timeout(10000), catchError(() => of([])))
    }).pipe(finalize(() => {
      if (!silent) {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    })).subscribe({
      next: (result) => {
        const epData = this.mapToApprovalRequest(result.ep, 'ep');
        const rfqData = this.mapToApprovalRequest(result.rfq, 'rfq');
        const nppData = this.mapToApprovalRequest(result.npp, 'npp');
        const prData = this.mapToApprovalRequest(result.pr, 'pr');
        const poData = this.mapToApprovalRequest(result.po, 'po');
        const paymentData = this.mapToApprovalRequest(result.payment, 'payment');
        
        this.allRequests = [...epData, ...rfqData, ...nppData, ...prData, ...poData, ...paymentData];
        this.allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        this.calculateStats();
        this.applyFilters();
        
        if (!silent) {
          this.showToast('Approvals loaded successfully', 'success');
        }
      },
      error: (error) => {
        console.error('Failed to load approvals:', error);
        if (!silent) {
          this.showToast('Failed to load approvals. Please try again.', 'error');
        }
      }
    });
  }
  
  private mapToApprovalRequest(data: any, type: string): ApprovalRequest[] {
    const items = data?.data || (Array.isArray(data) ? data : []);
    if (!Array.isArray(items)) return [];
    
    return items.map((item: any) => ({
      id: item._id || item.id,
      type: type as ApprovalRequest['type'],
      serialNo: item.uniqueSerialNo || item.serialNo || item._id?.slice(-8) || 'N/A',
      title: item.title || item.titleOfActivity || item.subject || 'Untitled',
      requester: item.requester || item.requesterName || item.createdBy?.name || 'Unknown',
      email: item.email || item.emailId || '',
      department: item.department || item.dept || 'General',
      priority: this.mapPriority(item.priority),
      status: this.mapStatus(item.status),
      amount: Number(item.amount || item.estimatedAmount || 0),
      requestDate: item.requestDate || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      vendor: item.vendor || item.vendorName,
      comments: item.comments || item.remarks,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    }));
  }
  
  private mapPriority(priority: string): 'High' | 'Medium' | 'Low' {
    const p = (priority || 'Medium').toLowerCase();
    if (p === 'high' || p === 'urgent') return 'High';
    if (p === 'low') return 'Low';
    return 'Medium';
  }
  
  private mapStatus(status: string): ApprovalRequest['status'] {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'in-process') return 'In-Process';
    return 'Pending';
  }
  
  private calculateStats(): void {
    this.approvalStats.total = this.allRequests.length;
    this.approvalStats.pending = this.allRequests.filter(r => r.status === 'Pending' || r.status === 'In-Process').length;
    this.approvalStats.approved = this.allRequests.filter(r => r.status === 'Approved').length;
    this.approvalStats.rejected = this.allRequests.filter(r => r.status === 'Rejected').length;
    this.approvalStats.inProcess = this.allRequests.filter(r => r.status === 'In-Process').length;
    
    // Calculate by type
    const types = ['ep', 'rfq', 'npp', 'pr', 'po', 'payment', 'wcc', 'comparison'];
    types.forEach(type => {
      const typedRequests = this.allRequests.filter(r => r.type === type);
      this.approvalStats.byType[type as keyof typeof this.approvalStats.byType] = {
        total: typedRequests.length,
        pending: typedRequests.filter(r => r.status === 'Pending' || r.status === 'In-Process').length,
        approved: typedRequests.filter(r => r.status === 'Approved').length,
        rejected: typedRequests.filter(r => r.status === 'Rejected').length
      };
    });
  }
  
  applyFilters(): void {
    let filtered = [...this.allRequests];
    
    // Filter by tab (status)
    if (this.activeTab === 'pending') {
      filtered = filtered.filter(r => r.status === 'Pending' || r.status === 'In-Process');
    } else if (this.activeTab !== 'all') {
      const statusMap = {
        'approved': 'Approved',
        'rejected': 'Rejected',
        'in-process': 'In-Process'
      };
      filtered = filtered.filter(r => r.status === statusMap[this.activeTab as keyof typeof statusMap]);
    }
    
    // Filter by type
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === this.typeFilter);
    }
    
    // Filter by priority
    if (this.priorityFilter !== 'all') {
      filtered = filtered.filter(r => r.priority === this.priorityFilter);
    }
    
    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(term) ||
        r.requester.toLowerCase().includes(term) ||
        r.serialNo.toLowerCase().includes(term) ||
        r.department.toLowerCase().includes(term)
      );
    }
    
    this.filteredRequests = filtered;
    this.cdr.detectChanges();
  }
  
  setActiveTab(tab: 'all' | 'pending' | 'approved' | 'rejected' | 'in-process'): void {
    this.activeTab = tab;
    this.applyFilters();
  }
  
  clearFilters(): void {
    this.searchTerm = '';
    this.typeFilter = 'all';
    this.priorityFilter = 'all';
    this.applyFilters();
  }
  
  viewDetails(request: ApprovalRequest): void {
    this.selectedRequest = request;
    this.showDetailsModal = true;
  }
  
  openApproveModal(request: ApprovalRequest): void {
    this.selectedRequest = request;
    this.approvalComments = '';
    this.showApproveModal = true;
  }
  
  openRejectModal(request: ApprovalRequest): void {
    this.selectedRequest = request;
    this.rejectionReason = '';
    this.showRejectModal = true;
  }
  
  approveRequest(): void {
    if (!this.selectedRequest) return;
    
    this.isSubmitting = true;
    let approvalObservable;
    
    switch (this.selectedRequest.type) {
      case 'ep':
        approvalObservable = this.authService.approveEPRequest(this.selectedRequest.id, this.approvalComments);
        break;
      case 'rfq':
        approvalObservable = this.authService.approveRFQ(this.selectedRequest.id, this.approvalComments);
        break;
      default:
        approvalObservable = this.authService.approveRequestByType(this.selectedRequest.type, this.selectedRequest.id, this.approvalComments);
    }
    
    approvalObservable.pipe(finalize(() => {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: (res) => {
        this.showToast(`${this.selectedRequest!.type.toUpperCase()} request approved successfully!`, 'success');
        this.closeModals();
        this.loadApprovals();
      },
      error: (err) => {
        this.showToast(err?.message || 'Failed to approve request', 'error');
      }
    });
  }
  
  rejectRequest(): void {
    if (!this.selectedRequest) return;
    
    if (!this.rejectionReason.trim()) {
      this.showToast('Please provide a reason for rejection', 'warning');
      return;
    }
    
    this.isSubmitting = true;
    let rejectionObservable;
    
    switch (this.selectedRequest.type) {
      case 'ep':
        rejectionObservable = this.authService.rejectEPRequest(this.selectedRequest.id, this.rejectionReason);
        break;
      case 'rfq':
        rejectionObservable = this.authService.rejectRFQ(this.selectedRequest.id, this.rejectionReason);
        break;
      default:
        rejectionObservable = this.authService.rejectRequestByType(this.selectedRequest.type, this.selectedRequest.id, this.rejectionReason);
    }
    
    rejectionObservable.pipe(finalize(() => {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    })).subscribe({
      next: (res) => {
        this.showToast(`${this.selectedRequest!.type.toUpperCase()} request rejected`, 'info');
        this.closeModals();
        this.loadApprovals();
      },
      error: (err) => {
        this.showToast(err?.message || 'Failed to reject request', 'error');
      }
    });
  }
  
  closeModals(): void {
    this.showDetailsModal = false;
    this.showApproveModal = false;
    this.showRejectModal = false;
    this.selectedRequest = null;
    this.approvalComments = '';
    this.rejectionReason = '';
  }
  
  getPriorityClass(priority: string): string {
    const classes = {
      'High': 'priority-high',
      'Medium': 'priority-medium',
      'Low': 'priority-low'
    };
    return classes[priority as keyof typeof classes] || 'priority-medium';
  }
  
  getStatusClass(status: string): string {
    const classes = {
      'Approved': 'status-approved',
      'Rejected': 'status-rejected',
      'Pending': 'status-pending',
      'In-Process': 'status-inprocess'
    };
    return classes[status as keyof typeof classes] || 'status-pending';
  }
  
  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'ep': '📋',
      'rfq': '📄',
      'npp': '🛒',
      'pr': '🧾',
      'po': '📦',
      'payment': '💰'
    };
    return icons[type] || '📌';
  }
  
  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'ep': 'EP Request',
      'rfq': 'RFQ',
      'npp': 'NPP',
      'pr': 'PR',
      'po': 'PO',
      'payment': 'Payment'
    };
    return labels[type] || type.toUpperCase();
  }
  
  formatAmount(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + amount.toLocaleString('en-IN');
  }
  
  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
  
  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number = 4000): void {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast: Toast = {
      id: ++this.toastIdCounter,
      type,
      message,
      icon: icons[type]
    };
    this.toasts.push(toast);
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
      this.cdr.detectChanges();
    }, duration);
  }
  
  navigateToCreate(): void {
    this.router.navigate(['/ep-approval']);
  }
  
  getApprovalRate(): number {
    if (this.approvalStats.total === 0) return 0;
    return Math.round((this.approvalStats.approved / this.approvalStats.total) * 100);
  }
  
  getPendingRate(): number {
    if (this.approvalStats.total === 0) return 0;
    return Math.round((this.approvalStats.pending / this.approvalStats.total) * 100);
  }
}

export type { ApprovalRequest, ApprovalStats };
