import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

interface PrItem {
  rfqNo: string;
  supplierName: string;
  partCode: string;
  partDescription: string;
  specification: string;
  cmdt: string;
  uom: string;
  qty: number;
  currency: string;
  unitPrice: number;
  totalValue: number;
}

@Component({
  selector: 'app-pr-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pr-request.html',
  styleUrls: ['./pr-request.scss'],
})
export class PrRequest implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  form = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    contactNo: '',
    organization: 'Radiant Appliances',
    requestDate: new Date().toISOString().split('T')[0],
    titleOfActivity: 'PR process for approval',
    purposeAndObjective: 'Operational support and action plan for NON-BOM procurement',
    priority: 'H',
    departmentBudget: '',
    balance: '',
    costCenter: '',
    alternativeCostCenter: ''
  };

  items: PrItem[] = [
    { rfqNo: '', supplierName: '', partCode: '', partDescription: '', specification: '', cmdt: '', uom: 'Nos', qty: 1, currency: 'INR', unitPrice: 0, totalValue: 0 }
  ];

  approvers = [
    { line: 'Parallel', managerName: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager', status: 'Pending', remarks: '' },
    { line: 'Sequential', managerName: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP', status: 'Pending', remarks: '' }
  ];

  isSubmitting = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (!user) return;
    this.form.requesterName = user.name || '';
    this.form.emailId = user.email || '';
    this.form.department = user.department || 'Purchase';
    this.form.contactNo = user.contactNo || '';
  }

  addItem(): void {
    this.items.push({ rfqNo: '', supplierName: '', partCode: '', partDescription: '', specification: '', cmdt: '', uom: 'Nos', qty: 1, currency: 'INR', unitPrice: 0, totalValue: 0 });
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.splice(index, 1);
  }

  calculateItem(item: PrItem): void {
    item.totalValue = Number(item.qty || 0) * Number(item.unitPrice || 0);
  }

  getTotalValue(): number {
    return this.items.reduce((sum, item) => sum + Number(item.totalValue || 0), 0);
  }

  submitForm(): void {
    if (!this.form.requesterName.trim() || !this.form.titleOfActivity.trim()) {
      alert('Requester and title are required');
      return;
    }

    this.isSubmitting = true;
    const serialNo = `PR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        serialNo,
        type: 'pr-request',
        data: {
          form: { ...this.form, amount: this.getTotalValue() },
          items: this.items,
          approvers: this.approvers
        }
      });
    }, 700);
  }
}
