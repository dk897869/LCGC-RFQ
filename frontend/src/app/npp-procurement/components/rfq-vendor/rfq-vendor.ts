import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import * as XLSX from 'xlsx';

interface RfqVendorItemRow {
  rfqNo: string;
  description: string;
  uom: string;
  quantity: number;
  make: string;
  alternative: string;
  currency: string;
  unitCost: number;
  value: number;
  remark: string;
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
  selector: 'app-rfq-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rfq-vendor.html',
  styleUrls: ['./rfq-vendor.scss']
})
export class RfqVendorComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  rfqVendorForm: any = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    requestDate: new Date().toISOString().split('T')[0],
    contactNo: '',
    organization: 'Radiant Appliances',
    titleOfActivity: '',
    purposeAndObjective: '',
    quotationStatus: 'Draft',
    priority: 'M'
  };
  
  rfqVendorItems: RfqVendorItemRow[] = [{ rfqNo: '', description: '', uom: 'Pcs', quantity: 0, make: '', alternative: '', currency: 'INR', unitCost: 0, value: 0, remark: '' }];
  rfqVendorApprovers: ApproverRow[] = [{ line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', dateTime: '', remarks: '' }];
  isSubmitting = false;
  importFileName = '';

  managerOptions = [
    { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager' },
    { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM' },
    { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadUserInfo();
    this.loadManagers();
  }

  loadUserInfo() {
    const user = this.authService.getUser();
    if (user) {
      this.rfqVendorForm.requesterName = user.name || '';
      this.rfqVendorForm.emailId = user.email || '';
      this.rfqVendorForm.department = user.department || 'Purchase';
      this.rfqVendorForm.contactNo = user.contactNo || '';
    }
  }

  loadManagers() {
    this.authService.getManagers().subscribe({
      next: (res: any) => {
        const list = res?.managers || res?.defaultApprovers || [];
        if (Array.isArray(list) && list.length) this.managerOptions = list;
      },
      error: () => {}
    });
  }

  addRfqVendorItem() {
    this.rfqVendorItems.push({ rfqNo: '', description: '', uom: 'Pcs', quantity: 0, make: '', alternative: '', currency: 'INR', unitCost: 0, value: 0, remark: '' });
  }

  removeRfqVendorItem(index: number) {
    if (this.rfqVendorItems.length > 1) {
      this.rfqVendorItems.splice(index, 1);
    }
  }

  calcRfqVendorValue(item: RfqVendorItemRow) {
    item.value = item.quantity * item.unitCost;
  }

  getRfqVendorTotal(): number {
    return this.rfqVendorItems.reduce((sum, item) => sum + item.value, 0);
  }

  addRfqVendorApprover() {
    this.rfqVendorApprovers.push({ line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', dateTime: '', remarks: '' });
  }

  removeRfqVendorApprover(index: number) {
    if (this.rfqVendorApprovers.length > 1) {
      this.rfqVendorApprovers.splice(index, 1);
    }
  }

  onManagerLookup(approver: ApproverRow, value: string) {
    const term = (value || '').trim().toLowerCase();
    approver.managerName = value;
    const manager = this.managerOptions.find(m =>
      (m.name || '').toLowerCase() === term || (m.email || '').toLowerCase() === term
    );
    if (manager) {
      approver.email = manager.email;
      approver.designation = manager.designation;
      approver.dateTime = new Date().toLocaleString();
    }
  }

  generateSerialNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RFQ-V-${year}${month}${day}-${random}`;
  }

  downloadExcelTemplate() {
    const headers = ['RFQ No', 'Description', 'UOM', 'Qty', 'Make', 'Alternative', 'Currency', 'Unit Cost', 'Remark'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Vendor Template');
    XLSX.writeFile(wb, 'rfq_vendor_template.xlsx');
  }

  onExcelFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const imported = rows.map(row => ({
        rfqNo: row['RFQ No'] || '',
        description: row['Description'] || '',
        uom: row['UOM'] || 'Pcs',
        quantity: Number(row['Qty'] || 0),
        make: row['Make'] || '',
        alternative: row['Alternative'] || '',
        currency: row['Currency'] || 'INR',
        unitCost: Number(row['Unit Cost'] || 0),
        value: 0,
        remark: row['Remark'] || ''
      })).filter(item => item.description);
      
      if (imported.length) {
        this.rfqVendorItems = imported;
        this.rfqVendorItems.forEach(item => this.calcRfqVendorValue(item));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  exportToExcel() {
    const rows = this.rfqVendorItems.map(item => ({
      'RFQ No': item.rfqNo,
      'Description': item.description,
      'UOM': item.uom,
      'Quantity': item.quantity,
      'Make': item.make,
      'Alternative': item.alternative,
      'Currency': item.currency,
      'Unit Cost': item.unitCost,
      'Value': item.value,
      'Remark': item.remark
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Vendor Items');
    XLSX.writeFile(wb, `rfq_vendor_export.xlsx`);
  }

  validateForm(): boolean {
    if (!this.rfqVendorForm.titleOfActivity?.trim()) {
      alert('Title of Activity is required');
      return false;
    }
    return true;
  }

  submitForm() {
    if (!this.validateForm()) return;
    
    this.isSubmitting = true;
    const serialNo = this.generateSerialNumber();
    
    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        serialNo: serialNo,
        type: 'rfq-vendor',
        data: {
          form: this.rfqVendorForm,
          items: this.rfqVendorItems,
          approvers: this.rfqVendorApprovers
        }
      });
      
      // Reset
      this.rfqVendorForm.titleOfActivity = '';
      this.rfqVendorItems = [{ rfqNo: '', description: '', uom: 'Pcs', quantity: 0, make: '', alternative: '', currency: 'INR', unitCost: 0, value: 0, remark: '' }];
    }, 1000);
  }
}
