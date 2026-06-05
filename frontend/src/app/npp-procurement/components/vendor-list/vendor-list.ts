import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface VendorMasterRow {
  select: boolean;
  name: string;
  code: string;
  emailId: string;
  phoneNo: string;
  password: string;
  status: string;
  gst: string;
  msme: string;
  penCard: string;
  address: string;
  location: string;
}

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-list.html',
  styleUrls: ['./vendor-list.scss']
})
export class VendorListComponent implements OnInit {
  vendorMasterList: VendorMasterRow[] = [
    { select: true, name: 'Sohiab Trader', code: 'IL2964', emailId: 'ramp@xyz', phoneNo: '9852635237', password: 'zzzzz', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Japnoor Enterprise', code: 'IL8765', emailId: 'kps@xyz', phoneNo: '9852635765', password: 'dddd', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Santhosh Electronics', code: 'IL6789', emailId: 'ghj@xyz', phoneNo: '9852635567', password: 'hhhh', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Spycloud', code: 'IL9876', emailId: 'rakt@xyz', phoneNo: '9852635988', password: 'iiiii', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
  ];
  
  filteredVendors: VendorMasterRow[] = [];
  filterCode = '';
  filterName = '';
  filterEmail = '';
  filterPhone = '';
  
  showToast = false;
  toastMessage = '';
  toastType = 'success';

  ngOnInit() {
    this.applyFilters();
  }

  applyFilters() {
    this.filteredVendors = this.vendorMasterList.filter(v =>
      (!this.filterCode || v.code.toLowerCase().includes(this.filterCode.toLowerCase())) &&
      (!this.filterName || v.name.toLowerCase().includes(this.filterName.toLowerCase())) &&
      (!this.filterEmail || v.emailId.toLowerCase().includes(this.filterEmail.toLowerCase())) &&
      (!this.filterPhone || v.phoneNo.includes(this.filterPhone))
    );
  }

  addVendorRow() {
    this.vendorMasterList.push({
      select: false,
      name: '',
      code: '',
      emailId: '',
      phoneNo: '',
      password: '',
      status: 'Active',
      gst: '',
      msme: '',
      penCard: '',
      address: '',
      location: ''
    });
    this.applyFilters();
    this.showMessage('New vendor row added', 'success');
  }

  saveVendor(vendor: VendorMasterRow) {
    this.showMessage(`Vendor "${vendor.name}" saved successfully`, 'success');
  }

  deleteVendor(index: number) {
    if (confirm('Are you sure you want to delete this vendor?')) {
      this.vendorMasterList.splice(index, 1);
      this.applyFilters();
      this.showMessage('Vendor deleted successfully', 'success');
    }
  }

  exportToExcel() {
    const rows = this.filteredVendors.map(v => ({
      'Vendor Code': v.code,
      'Vendor Name': v.name,
      'Email ID': v.emailId,
      'Phone No': v.phoneNo,
      'Status': v.status,
      'GST': v.gst,
      'MSME': v.msme,
      'Address': v.address,
      'Location': v.location
    }));
    
    console.log('Export to Excel:', rows);
    this.showMessage('Export started', 'success');
  }

  showMessage(message: string, type: string) {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => { this.showToast = false; }, 3000);
  }
}