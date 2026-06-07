import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

interface ReportRow {
  id: string;
  reportId: string;
  reportName: string;
  module: string;
  category: string;
  requestedBy: string;
  dateRange: string;
  generatedOn: string;
  status: string;
  format: string;
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-dashboard.html',
  styleUrls: ['./reports-dashboard.scss']
})
export class ReportsDashboardComponent implements OnInit {
  isLoading = false;
  searchTerm = '';
  reportType = 'all';
  moduleFilter = 'all';
  categoryFilter = 'all';
  statusFilter = 'all';
  fromDate = '';
  toDate = '';

  summary = {
    total: 0, generated: 0, scheduled: 0, inProgress: 0, failed: 0,
    ep: 0, rfq: 0, po: 0, pr: 0, payment: 0, cash: 0
  };

  rows: ReportRow[] = [];
  filteredRows: ReportRow[] = [];
  page = 1;
  pageSize = 10;

  constructor(private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    this.toDate = end.toISOString().split('T')[0];
    this.fromDate = start.toISOString().split('T')[0];
    this.loadReports();
  }

  loadReports() {
    this.isLoading = true;
    const started = Date.now();
    this.auth.getReports(this.fromDate, this.toDate, this.reportType, this.searchTerm).subscribe({
      next: (res: any) => {
        const wait = Math.max(0, 2000 - (Date.now() - started));
        setTimeout(() => {
          const details = res?.data?.details || [];
          const sum = res?.data?.summary || {};
          this.summary.total = sum.total || details.length;
          this.summary.generated = sum.approved || details.filter((r: any) => r.status === 'Approved').length;
          this.summary.inProgress = sum.inProcess || details.filter((r: any) => ['In Process', 'In-Process', 'Pending'].includes(r.status)).length;
          this.summary.failed = sum.rejected || details.filter((r: any) => r.status === 'Rejected').length;
          this.summary.scheduled = Math.max(0, Math.round(this.summary.total * 0.14));
          this.rows = details.map((r: any, i: number) => this.mapRow(r, i));
          this.computeCategoryCounts();
          this.applyFilters();
          this.isLoading = false;
          this.cdr.detectChanges();
        }, wait);
      },
      error: () => {
        setTimeout(() => {
          this.rows = [];
          this.applyFilters();
          this.isLoading = false;
          this.cdr.detectChanges();
        }, 2000);
      }
    });
  }

  private mapRow(r: any, i: number): ReportRow {
    const mod = this.moduleFromType(r.type);
    return {
      id: String(r._id || r.id || i),
      reportId: r.uniqueSerialNo || r.serialNo || `RPT-${i + 1}`,
      reportName: r.titleOfActivity || r.title || 'Untitled Report',
      module: mod,
      category: mod,
      requestedBy: r.requesterName || r.requester || '—',
      dateRange: this.formatDate(r.requestDate || r.createdAt),
      generatedOn: this.formatDate(r.updatedAt || r.createdAt),
      status: this.mapStatus(r.status),
      format: i % 3 === 0 ? 'PDF' : 'Excel'
    };
  }

  private moduleFromType(type: string): string {
    const t = String(type || '').toLowerCase();
    if (t.includes('ep')) return 'EP Approvals';
    if (t.includes('rfq')) return 'RFQ Reports';
    if (t.includes('pr')) return 'PR Reports';
    if (t.includes('po')) return 'PO Reports';
    if (t.includes('payment')) return 'Payment Reports';
    if (t.includes('quotation') || t.includes('comparison')) return 'RFQ Reports';
    return 'NPP Reports';
  }

  private mapStatus(s: string): string {
    const v = String(s || 'Pending');
    if (v.toLowerCase().includes('approve')) return 'Completed';
    if (v.toLowerCase().includes('reject')) return 'Failed';
    if (v.toLowerCase().includes('process')) return 'In Progress';
    return 'In Progress';
  }

  private computeCategoryCounts() {
    const count = (m: string) => this.rows.filter(r => r.module === m).length;
    this.summary.ep = count('EP Approvals');
    this.summary.rfq = count('RFQ Reports');
    this.summary.pr = count('PR Reports');
    this.summary.po = count('PO Reports');
    this.summary.payment = count('Payment Reports');
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredRows = this.rows.filter(r => {
      const matchType = this.reportType === 'all' || r.module.toLowerCase().includes(this.reportType);
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      const hay = [r.reportId, r.reportName, r.requestedBy, r.module].join(' ').toLowerCase();
      return matchType && matchStatus && (!term || hay.includes(term));
    });
    this.page = 1;
  }

  resetFilters() {
    this.reportType = 'all';
    this.moduleFilter = 'all';
    this.categoryFilter = 'all';
    this.statusFilter = 'all';
    this.searchTerm = '';
    this.loadReports();
  }

  get pagedRows(): ReportRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  statusClass(status: string): string {
    if (status === 'Completed') return 'st-completed';
    if (status === 'Failed') return 'st-failed';
    return 'st-progress';
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  exportCsv() {
    this.auth.exportReportToCSV(this.fromDate, this.toDate, this.reportType).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lcgc_reports_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }
}
