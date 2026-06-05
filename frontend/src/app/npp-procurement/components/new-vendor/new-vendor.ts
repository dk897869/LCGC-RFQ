import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';

interface VendorDetail {
  vendorCode: string;
  supplierName: string;
  gstNo: string;
  panNo: string;
  msme: string;
  bankAccountNo: string;
  contactPerson: string;
  contactNo: string;
  email: string;
  address: string;
  location: string;
  paymentTerm: string;
}

@Component({
  selector: 'app-new-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-vendor.html',
  styleUrls: ['./new-vendor.scss']
})
export class NewVendorComponent implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();

  rfqNo = 'NV-2026-XXX';
  requestDate = '';

  form: any = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    contactNo: '',
    organization: 'Radiant Appliances',
    titleOfActivity: 'Approval For: New Vendor registration'
  };

  vendorDetails: VendorDetail[] = [{
    vendorCode: '', supplierName: '', gstNo: '', panNo: '', msme: '',
    bankAccountNo: '', contactPerson: '', contactNo: '', email: '',
    address: '', location: '', paymentTerm: ''
  }];

  isSubmitting = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.loadUserInfo();
    const today = new Date();
    this.requestDate = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  loadUserInfo() {
    const user = this.authService.getUser();
    if (user) {
      this.form.requesterName = user.name || 'Chandra Shekhar';
      this.form.emailId = user.email || '';
      this.form.department = user.department || 'Purchase';
      this.form.contactNo = user.contactNo || '8806668006';
    }
  }

  addVendor() {
    this.vendorDetails.push({
      vendorCode: '', supplierName: '', gstNo: '', panNo: '', msme: '',
      bankAccountNo: '', contactPerson: '', contactNo: '', email: '',
      address: '', location: '', paymentTerm: ''
    });
  }

  removeVendor(index: number) {
    if (this.vendorDetails.length > 1) {
      this.vendorDetails.splice(index, 1);
    }
  }

  submitForm() {
    this.isSubmitting = true;
    const serialNo = `NV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(Math.random()*10000)}`;

    setTimeout(() => {
      this.isSubmitting = false;
      this.onSubmit.emit({
        success: true,
        serialNo,
        type: 'new-vendor',
        data: {
          form: this.form,
          vendorDetails: this.vendorDetails
        }
      });
    }, 1000);
  }
}