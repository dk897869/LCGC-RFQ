import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

interface VendorRfqRow {
  id: string;
  rfqNo: string;
  title: string;
  department: string;
  endDate: string;
  status: string;
  requestedBy: string;
}

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-dashboard.html',
  styleUrls: ['./vendor-dashboard.scss']
})
export class VendorDashboardComponent implements OnInit, OnDestroy {
  isLoading = false;
  currentTime = '';
  currentDate = '';
  vendorName = '';
  vendorEmail = '';
  vendorPhone = '';
  vendorId = '';
  memberSince = '';

  stats = {
    totalRfqs: 0,
    pending: 0,
    submitted: 0,
    accepted: 0,
    orders: 0
  };

  statusBreakdown = { pending: 0, submitted: 0, shortlisted: 0, awarded: 0 };
  rows: any[] = [];
  filteredRows: any[] = [];
  statusFilter = 'all';
  searchTerm = '';
  page = 1;
  pageSize = 8;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  showDetailsModal = false;
  showRejectModal = false;
  selectedRfq: any = null;
  rejectionRemarks = '';
  isSubmitting = false;

  constructor(private auth: AuthService, private cdr: ChangeDetectorRef, private router: Router) {}

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') {
    window.dispatchEvent(new CustomEvent('app-toast', {
      detail: { message, type }
    }));
  }

  viewRfqDetails(row: any) {
    this.selectedRfq = row;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedRfq = null;
  }

  acceptRfq(row: any) {
    this.isSubmitting = true;
    this.auth.acceptVendorRfq(row.id).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('RFQ Invitation Accepted Successfully! Notification sent.', 'success');
        this.closeDetailsModal();
        this.loadData();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to accept RFQ', 'error');
      }
    });
  }

  rejectRfqFromTable(row: any) {
    this.selectedRfq = row;
    this.openRejectModal();
  }

  openRejectModal() {
    this.rejectionRemarks = '';
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.rejectionRemarks = '';
  }

  submitRejection() {
    if (!this.rejectionRemarks.trim()) {
      this.showToast('Please provide a reason/remarks for rejection', 'warning');
      return;
    }
    this.isSubmitting = true;
    this.auth.rejectVendorRfq(this.selectedRfq.id, this.rejectionRemarks).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.showToast('RFQ Invitation Rejected. Notification sent.', 'info');
        this.closeRejectModal();
        this.closeDetailsModal();
        this.loadData();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.showToast(err?.message || 'Failed to reject RFQ', 'error');
      }
    });
  }

  ngOnInit() {
    const user = this.auth.getUser();
    this.vendorName = user?.organization || user?.name || 'Vendor';
    this.vendorEmail = user?.email || '';
    this.vendorPhone = user?.contactNo || user?.phone || '';
    this.vendorId = user?.vendorAccount?.vendorId || `VEND-${user?.id?.slice(-4) || '0000'}`;
    this.memberSince = user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.loadData();
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private tickClock() {
    const n = new Date();
    this.currentTime = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    this.currentDate = n.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  loadData() {
    this.isLoading = true;
    const started = Date.now();
    this.auth.getMyVendorRfqs().subscribe({
      next: (res: any) => {
        const wait = Math.max(0, 2000 - (Date.now() - started));
        setTimeout(() => {
          const data = res?.data || [];
          this.rows = data.map((r: any) => ({
            id: String(r._id || r.id),
            rfqNo: r.uniqueSerialNo || r.rfqNo || '—',
            title: r.titleOfActivity || r.title || 'Untitled',
            department: r.department || '—',
            endDate: this.fmt(r.dueDate || r.endDate || r.requestDate),
            status: this.normStatus(r.status),
            requestedBy: r.requesterName || r.requester || '—',
            raw: r
          }));
          this.computeStats();
          this.applyFilters();
          this.isLoading = false;
          this.cdr.detectChanges();
        }, wait);
      },
      error: () => {
        setTimeout(() => {
          this.rows = [];
          this.computeStats();
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 2000);
      }
    });
  }

  private computeStats() {
    this.stats.totalRfqs = this.rows.length;
    this.stats.pending = this.rows.filter(r => r.status === 'Pending').length;
    this.stats.submitted = this.rows.filter(r => r.status === 'Submitted').length;
    this.stats.accepted = this.rows.filter(r => ['Awarded', 'Approved', 'Accepted'].includes(r.status)).length;
    this.stats.orders = Math.round(this.stats.accepted * 0.8);
    this.statusBreakdown = {
      pending: this.stats.pending,
      submitted: this.stats.submitted,
      shortlisted: this.rows.filter(r => r.status === 'Shortlisted').length,
      awarded: this.stats.accepted
    };
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredRows = this.rows.filter(r => {
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      const hay = [r.rfqNo, r.title, r.department, r.requestedBy].join(' ').toLowerCase();
      return matchStatus && (!term || hay.includes(term));
    });
    this.page = 1;
  }

  get pagedRows(): VendorRfqRow[] {
    const s = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(s, s + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  statusClass(s: string): string {
    const m: Record<string, string> = {
      Pending: 'st-pending', Submitted: 'st-submitted', Shortlisted: 'st-shortlisted',
      Awarded: 'st-awarded', Approved: 'st-awarded', Rejected: 'st-rejected'
    };
    return m[s] || 'st-pending';
  }

  private normStatus(s: string): string {
    const v = String(s || 'Pending');
    if (v.toLowerCase().includes('approve') || v.toLowerCase().includes('award')) return 'Awarded';
    if (v.toLowerCase().includes('submit')) return 'Submitted';
    if (v.toLowerCase().includes('short')) return 'Shortlisted';
    if (v.toLowerCase().includes('reject')) return 'Rejected';
    return 'Pending';
  }

  private fmt(d?: string): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  pct(part: number): string {
    if (!this.stats.totalRfqs) return '0';
    return ((part / this.stats.totalRfqs) * 100).toFixed(1);
  }
}
