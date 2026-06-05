import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

interface CashPurchaseItem {
  itemDescription: string;
  purpose: string;
  paymentDetail: string;
  billInvoiceCopy: string;
}

interface ApproverRow {
  line: 'Parallel' | 'Sequential';
  managerName: string;
  email: string;
  designation: string;
  status: string;
  dateTime: string;
  remarks: string;
}

@Component({
  selector: 'app-cash-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-purchase.html',
  styleUrls: ['./cash-purchase.scss']
})
export class CashPurchaseComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  form: any = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    requestDate: new Date().toISOString().split('T')[0],
    contactNo: '',
    organization: 'Radiant Appliances',
    titleOfActivity: '',
    purposeAndObjective: '',
    costCenter: ''
  };

  items: CashPurchaseItem[] = [{ itemDescription: '', purpose: '', paymentDetail: '', billInvoiceCopy: '' }];
  approvers: ApproverRow[] = [];
  attachments: any[] = [];
  isSubmitting = false;

  managerOptions = [
    { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager' },
    { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM' },
    { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadUserInfo();
    this.addApprover();
  }

  loadUserInfo() {
    const user = this.authService.getUser();
    if (user) {
      this.form.requesterName = user.name || '';
      this.form.emailId = user.email || '';
      this.form.department = user.department || 'Purchase';
      this.form.contactNo = user.contactNo || '';
    }
  }

  addItem() {
    this.items.push({ itemDescription: '', purpose: '', paymentDetail: '', billInvoiceCopy: '' });
  }

  removeItem(index: number) {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
    }
  }

  addApprover() {
    this.approvers.push({
      line: 'Parallel',
      managerName: '',
      email: '',
      designation: '',
      status: 'Pending',
      dateTime: '',
      remarks: ''
    });
  }

  removeApprover(index: number) {
    if (this.approvers.length > 1) {
      this.approvers.splice(index, 1);
    }
  }

  onManagerChange(approver: ApproverRow, name: string) {
    const manager = this.managerOptions.find(m => m.name === name);
    if (manager) {
      approver.email = manager.email;
      approver.designation = manager.designation;
      approver.dateTime = new Date().toLocaleString();
    }
  }

  handleFiles(event: any) {
    // Handle file attachments
    console.log('Files selected:', event.target.files);
  }

  generateSerialNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CP-${year}${month}${day}-${random}`;
  }

  validateForm(): boolean {
    if (!this.form.titleOfActivity?.trim()) {
      alert('Title of Activity is required');
      return false;
    }
    if (!this.form.requesterName?.trim()) {
      alert('Requester name is required');
      return false;
    }
    return true;
  }

  submit() {
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    const serialNo = this.generateSerialNumber();

    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        serialNo: serialNo,
        type: 'cash-purchase',
        data: {
          form: this.form,
          items: this.items,
          approvers: this.approvers
        }
      });

      // Reset Form
      this.form.titleOfActivity = '';
      this.form.purposeAndObjective = '';
      this.form.costCenter = '';
      this.items = [{ itemDescription: '', purpose: '', paymentDetail: '', billInvoiceCopy: '' }];
    }, 1000);
  }
}