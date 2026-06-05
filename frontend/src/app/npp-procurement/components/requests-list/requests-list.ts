import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

interface NPPRequest {
  id: string;
  serialNo: string;
  title: string;
  requester: string;
  email: string;
  department: string;
  amount: number;
  priority: string;
  status: string;
  requestDate: string;
  type: string;
}

@Component({
  selector: 'app-requests-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './requests-list.html',
  styleUrls: ['./requests-list.scss']
})
export class RequestsListComponent implements OnInit {
  allRequests: NPPRequest[] = [];
  filteredRequests: NPPRequest[] = [];
  searchTerm = '';
  statusFilter = 'All';
  typeFilter = 'All';
  isLoading = false;

  statusOptions = ['All', 'Pending', 'Approved', 'Rejected', 'In Process'];
  typeOptions = ['All', 'RFQ', 'PR', 'PO', 'Payment'];

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading = true;
    this.authService.getNppRequests().subscribe({
      next: (res: any) => {
        const data = res?.data || [];
        this.allRequests = data.map((r: any) => this.mapRequest(r));
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        // Sample data for demo
        this.allRequests = this.getSampleData();
        this.applyFilters();
        this.isLoading = false;
      }
    });
  }

  private mapRequest(r: any): NPPRequest {
    return {
      id: r._id || r.id,
      serialNo: r.uniqueSerialNo || 'N/A',
      title: r.title || r.titleOfActivity || 'Untitled',
      requester: r.requester || r.requesterName || 'Unknown',
      email: r.email || r.emailId || '',
      department: r.department || 'General',
      amount: Number(r.amount || 0),
      priority: r.priority === 'H' ? 'High' : r.priority === 'M' ? 'Medium' : r.priority === 'L' ? 'Low' : (r.priority || 'Medium'),
      status: r.status || 'Pending',
      requestDate: r.requestDate || new Date().toISOString().split('T')[0],
      type: r.source || 'RFQ'
    };
  }

  private getSampleData(): NPPRequest[] {
    return [
      { id: '1', serialNo: 'RFQ-2024-001', title: 'Sample RFQ Request', requester: 'John Doe', email: 'john@example.com', department: 'Purchase', amount: 50000, priority: 'High', status: 'Pending', requestDate: '2024-01-15', type: 'RFQ' },
      { id: '2', serialNo: 'PR-2024-002', title: 'Sample PR Request', requester: 'Jane Smith', email: 'jane@example.com', department: 'IT', amount: 25000, priority: 'Medium', status: 'Approved', requestDate: '2024-01-20', type: 'PR' }
    ];
  }

  applyFilters() {
    let filtered = [...this.allRequests];
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(term) || 
        r.requester.toLowerCase().includes(term) ||
        r.serialNo.toLowerCase().includes(term)
      );
    }
    
    if (this.statusFilter !== 'All') {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }
    
    if (this.typeFilter !== 'All') {
      filtered = filtered.filter(r => r.type === this.typeFilter);
    }
    
    this.filteredRequests = filtered;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'Approved': 'approved',
      'Rejected': 'rejected',
      'Pending': 'pending',
      'In Process': 'in-process'
    };
    return classes[status] || 'pending';
  }

  getPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low'
    };
    return classes[priority] || 'medium';
  }

  formatAmount(amount: number): string {
    return '₹' + amount.toLocaleString('en-IN');
  }
}