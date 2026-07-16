import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';

interface PoItem {
  partNo: string;
  itemDescription: string;
  hsn: string;
  uom: string;
  quantity: number;
  rate: number;
  discount: number;
  gst: number;
  deliveryDate: string;
  remark: string;
  supplier1Price?: number;
  supplier2Price?: number;
  supplier3Price?: number;
  selectedSupplier?: string;
}

interface Approver {
  line: string;
  managerName: string;
  email: string;
  designation: string;
  status: string;
  remarks: string;
}

interface Attachment {
  fileName: string;
  fileSize: string;
  remark: string;
}

interface PoRequest {
  _id?: string;
  id?: string;
  uniqueSerialNo?: string;
  orderNo?: string;
  rfqNo?: string;
  prNo?: string;
  vendorName: string;
  vendorCode?: string;
  vendorAddress?: string;
  vendorGst?: string;
  vendorContact?: string;
  vendorEmail?: string;
  requesterName: string;
  department: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Draft';
  requestDate?: string;
  orderDate?: string;
  createdAt?: string;
  items?: PoItem[];
  stakeholders?: Approver[];
  attachments?: Attachment[];
  selectedSupplier?: string;
  prData?: any;
}

@Component({
  selector: 'app-po-npp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './po-npp.html',
  styleUrls: ['./po-npp.scss'],
  providers: [DatePipe]
})
export class PoNpp implements OnInit {
  @Output() onSubmit = new EventEmitter<any>();
  @Input() prData: any = null;
  @Input() selectedSupplier: string = '';

  // ---------- View state ----------
  view: 'list' | 'form' = 'list';
  activeTab: 'All' | 'Approved' | 'Pending' | 'Rejected' = 'All';
  searchTerm = '';

  isSubmitting = false;
  isLoadingList = false;
  toast: { type: 'success' | 'error' | 'info'; message: string } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  allOrders: PoRequest[] = [];
  selectedOrder: PoRequest | null = null;
  showDetailModal = false;

  // ---------- Clock ----------
  currentDate: Date = new Date();
  currentTime: string = '';
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- Form model ----------
  form = {
    requesterName: '',
    department: 'Purchase',
    emailId: '',
    requestDate: new Date().toISOString().slice(0, 10),
    contactNo: '',
    organization: 'Radiant Appliances',
    titleOfActivity: 'Purchase Order Request',
    purposeAndObjective: '',
    priority: 'M',
    employeeId: 'EMP01345',
    location: 'Patiala, Punjab',
    requestPurpose: 'Purchase of AC Unit',

    vendorCode: '',
    vendorName: '',
    vendorAddress: '',
    vendorGst: '',
    vendorContact: '',
    vendorEmail: '',
    vendorKindAttn: '',

    orderNo: '',
    orderDate: new Date().toISOString().slice(0, 10),
    quotRef: '',
    prNo: '',
    prDate: '',
    purchaser: '',
    purchaserMobile: '',
    rfqNo: '',
    selectedSupplier: '',

    billingAddress: 'RADIANT APPLIANCES AND ELECTRONICS PVT. LTD.\nS-2 & 9, Survey No. 191, 192, EClty, Fakulla,\nMaheshwaram Mandl, Ranjeela Village, Rangareddy Hyderabad - 581053, Telangana, India',
    billingGst: '36AAACR4828E1ZS',
    shippingAddress: 'RADIANT APPLIANCES AND ELECTRONICS PVT. LTD.\nS-2 & 9, Survey No. 191, 192, EClty, Fakulla,\nMaheshwaram Mandl, Ranjeela Village, Rangareddy Hyderabad - 581053, Telangana, India',
    shippingGst: '36AAACR4828E1ZS',

    transporter: '',
    taxes: 'GST extra as applicable',
    terms: 'Please mention our Purchase Order number on every invoice, packing slip and correspondence.\nAll referenced documents will only be Invoice for Dispatch and Documents for Transporter with HSN Codes and accompany the supplies.\nOur order reference must be quoted in all supply related documents.\nKindly let us have order acknowledgement, or a token of your acceptance.\nThe rejections noticed if any during receipt at our warehouse or any subsequent stage will be replaced free of cost.\nSupplies should be from fresh batch / solution and identification labels must be inked with the material.\nWarranty/Applicability as per manufacturer warrant from the date of invoice copy and accompanying delivering the goods and non-functionality of the products. During the warranty period if our user any problems with material/customer it could be returned and the rectification shall have to be done by us.\nIf bill is finally upload Tax Invoice details in GST portal on or before payment of GST amount, M/s. RAEPL will debit to Vendor for the GST amount along with applicable interest payable.\nM/s. RAEPL will not accept any manual corrections on Tax invoice.\nApplicable Law: Used law will govern interpretation of this order and the vendors submit to the jurisdiction of the Hyderabad courts.',
    remarks: ''
  };

  items: PoItem[] = [
    { partNo: '', itemDescription: '', hsn: '', uom: 'Pcs', quantity: 1, rate: 0, discount: 0, gst: 18, deliveryDate: '', remark: '' }
  ];

  stakeholders: Approver[] = [
    { line: 'Sequential', managerName: '', email: '', designation: '', status: 'Pending', remarks: '' }
  ];

  attachments: Attachment[] = [
    { fileName: '', fileSize: '', remark: '' }
  ];

  ccEmails: string[] = [''];

  constructor(
    private authService: AuthService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (user) {
      this.form.requesterName = user.name || '';
      this.form.emailId = user.email || '';
      this.form.contactNo = user.contactNo || '';
      this.form.organization = user.organization || this.form.organization;
      this.form.purchaser = user.name || '';
    }
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadOrders();
    
    // If PR data is passed, prefill the form
    if (this.prData) {
      this.prefillFromPR(this.prData);
    }
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.currentDate = now;
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // ---------- Load Orders ----------
  loadOrders(): void {
    this.isLoadingList = true;
    this.authService.getPoNppRequests?.().subscribe({
      next: (res: any) => {
        this.allOrders = res?.data || res || [];
        this.isLoadingList = false;
      },
      error: () => {
        this.isLoadingList = false;
      }
    }) ?? (this.isLoadingList = false);
  }

  // ---------- Prefill from PR ----------
  prefillFromPR(prData: any): void {
    if (!prData) return;
    
    this.view = 'form';
    this.form.prNo = prData.prNumber || prData.prNo || '';
    this.form.rfqNo = prData.rfqNo || '';
    this.form.selectedSupplier = prData.selectedSupplier || this.selectedSupplier || '';
    this.form.requesterName = prData.requesterName || this.form.requesterName;
    this.form.department = prData.department || this.form.department;
    this.form.purposeAndObjective = prData.justifications || prData.purposeAndObjective || '';
    
    // Prefill vendor info
    if (prData.vendorName) {
      this.form.vendorName = prData.vendorName;
    }
    if (prData.vendorCode) {
      this.form.vendorCode = prData.vendorCode;
    }
    
    // Prefill items from PR
    if (prData.items && prData.items.length > 0) {
      this.items = prData.items.map((item: any, index: number) => ({
        partNo: item.itemCode || item.partCode || '',
        itemDescription: item.description || '',
        hsn: item.hsn || item.specs || '',
        uom: item.uom || 'Pcs',
        quantity: item.quantity || 1,
        rate: item.estimatedPrice || item.unitPrice || 0,
        discount: item.discount || 0,
        gst: item.gst || 18,
        deliveryDate: item.deliveryDate || '',
        remark: item.remark || '',
        supplier1Price: item.supplier1Price || 0,
        supplier2Price: item.supplier2Price || 0,
        supplier3Price: item.supplier3Price || 0,
        selectedSupplier: prData.selectedSupplier || ''
      }));
    }
    
    // Prefill approvers from PR stakeholders
    if (prData.stakeholders && prData.stakeholders.length > 0) {
      this.stakeholders = prData.stakeholders.map((s: any) => ({
        line: s.line || 'Sequential',
        managerName: s.managerName || s.name || '',
        email: s.email || '',
        designation: s.designation || '',
        status: s.status || 'Pending',
        remarks: s.remarks || ''
      }));
    }
    
    // Set selected supplier
    if (prData.selectedSupplier) {
      this.form.selectedSupplier = prData.selectedSupplier;
    }
  }

  // ---------- List filtering ----------
  get filteredOrders(): PoRequest[] {
    let list = this.allOrders;
    if (this.activeTab !== 'All') {
      list = list.filter(o => (o.status || 'Pending') === this.activeTab);
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      list = list.filter(o =>
        (o.uniqueSerialNo || o.orderNo || '').toLowerCase().includes(term) ||
        (o.vendorName || '').toLowerCase().includes(term) ||
        (o.rfqNo || '').toLowerCase().includes(term) ||
        (o.prNo || '').toLowerCase().includes(term)
      );
    }
    return list;
  }

  get countFor(): Record<string, number> {
    return {
      All: this.allOrders.length,
      Approved: this.allOrders.filter(o => o.status === 'Approved').length,
      Pending: this.allOrders.filter(o => (o.status || 'Pending') === 'Pending').length,
      Rejected: this.allOrders.filter(o => o.status === 'Rejected').length
    };
  }

  setTab(tab: 'All' | 'Approved' | 'Pending' | 'Rejected'): void {
    this.activeTab = tab;
  }

  // ---------- Navigation ----------
  openNewOrder(): void {
    this.resetForm();
    this.view = 'form';
  }

  openOrder(po: any): void {
    this.hydrateFormFromOrder(po);
    this.view = 'form';
  }

  viewOrder(po: PoRequest): void {
    this.selectedOrder = po;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedOrder = null;
  }

  backToList(): void {
    this.view = 'list';
  }

  // ---------- Approve/Reject PO ----------
  approvePO(po: PoRequest): void {
    const id = po._id || po.id;
    if (!id) {
      this.showToast('error', 'Cannot approve: No ID found');
      return;
    }
    this.authService.approveNppRequest(id).subscribe({
      next: () => {
        po.status = 'Approved';
        this.showToast('success', `PO ${po.uniqueSerialNo || po.orderNo} approved!`);
        if (this.showDetailModal) this.closeDetailModal();
        this.loadOrders();
      },
      error: (err: any) => {
        this.showToast('error', err?.message || 'Approval failed.');
      }
    });
  }

  rejectPO(po: PoRequest): void {
    const id = po._id || po.id;
    if (!id) {
      this.showToast('error', 'Cannot reject: No ID found');
      return;
    }
    this.authService.rejectNppRequest(id).subscribe({
      next: () => {
        po.status = 'Rejected';
        this.showToast('info', `PO ${po.uniqueSerialNo || po.orderNo} rejected.`);
        if (this.showDetailModal) this.closeDetailModal();
        this.loadOrders();
      },
      error: (err: any) => {
        this.showToast('error', err?.message || 'Rejection failed.');
      }
    });
  }

  // ---------- Form hydration ----------
  private hydrateFormFromOrder(po: any): void {
    this.form = { ...this.form, ...po };
    this.items = po.items?.length ? po.items : this.items;
    this.stakeholders = po.stakeholders?.length ? po.stakeholders : this.stakeholders;
    this.attachments = po.attachments?.length ? po.attachments : this.attachments;
    this.ccEmails = po.ccEmails?.length ? po.ccEmails : [''];
  }

  private resetForm(): void {
    this.form.orderNo = '';
    this.form.vendorName = '';
    this.form.vendorAddress = '';
    this.form.vendorCode = '';
    this.form.vendorGst = '';
    this.form.vendorContact = '';
    this.form.vendorEmail = '';
    this.form.vendorKindAttn = '';
    this.form.quotRef = '';
    this.form.prNo = '';
    this.form.prDate = '';
    this.form.purposeAndObjective = '';
    this.form.remarks = '';
    this.form.rfqNo = '';
    this.form.selectedSupplier = '';
    this.items = [{ partNo: '', itemDescription: '', hsn: '', uom: 'Pcs', quantity: 1, rate: 0, discount: 0, gst: 18, deliveryDate: '', remark: '' }];
    this.stakeholders = [{ line: 'Sequential', managerName: '', email: '', designation: '', status: 'Pending', remarks: '' }];
    this.attachments = [{ fileName: '', fileSize: '', remark: '' }];
    this.ccEmails = [''];
  }

  // ---------- Item calculations ----------
  itemBase(item: PoItem): number {
    return Number(item.quantity || 0) * Number(item.rate || 0);
  }

  itemAfterDiscount(item: PoItem): number {
    const base = this.itemBase(item);
    return base - (base * Number(item.discount || 0) / 100);
  }

  itemCgst(item: PoItem): number {
    return this.itemAfterDiscount(item) * (Number(item.gst || 0) / 2) / 100;
  }

  itemSgst(item: PoItem): number {
    return this.itemAfterDiscount(item) * (Number(item.gst || 0) / 2) / 100;
  }

  itemNetAmount(item: PoItem): number {
    return this.itemAfterDiscount(item) + this.itemCgst(item) + this.itemSgst(item);
  }

  get totalAmount(): number {
    return this.items.reduce((sum, item) => sum + this.itemNetAmount(item), 0);
  }

  get totalBeforeTax(): number {
    return this.items.reduce((sum, item) => sum + this.itemAfterDiscount(item), 0);
  }

  get totalCgst(): number {
    return this.items.reduce((sum, item) => sum + this.itemCgst(item), 0);
  }

  get totalSgst(): number {
    return this.items.reduce((sum, item) => sum + this.itemSgst(item), 0);
  }

  get pendingApprovals(): number {
    return this.stakeholders.filter(item => item.status === 'Pending').length;
  }

  // ---------- Row management ----------
  addItem(): void {
    this.items.push({ partNo: '', itemDescription: '', hsn: '', uom: 'Pcs', quantity: 1, rate: 0, discount: 0, gst: 18, deliveryDate: '', remark: '' });
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.splice(index, 1);
  }

  addApprover(): void {
    this.stakeholders.push({ line: 'Sequential', managerName: '', email: '', designation: '', status: 'Pending', remarks: '' });
  }

  removeApprover(index: number): void {
    if (this.stakeholders.length > 1) this.stakeholders.splice(index, 1);
  }

  addAttachment(): void {
    this.attachments.push({ fileName: '', fileSize: '', remark: '' });
  }

  removeAttachment(index: number): void {
    if (this.attachments.length > 1) this.attachments.splice(index, 1);
  }

  addCcEmail(): void {
    this.ccEmails.push('');
  }

  removeCcEmail(index: number): void {
    if (this.ccEmails.length > 1) this.ccEmails.splice(index, 1);
  }

  termsLines(): string[] {
    return (this.form.terms || '').split('\n').map(t => t.trim()).filter(Boolean);
  }

  // ---------- Submit ----------
  submit(): void {
    if (!this.form.requesterName || !this.form.emailId || !this.form.vendorName || !this.items[0].itemDescription) {
      this.showToast('error', 'Please fill requester, email, vendor and at least one item.');
      return;
    }

    this.isSubmitting = true;
    const payload = {
      ...this.form,
      amount: this.totalAmount,
      items: this.items,
      stakeholders: this.stakeholders.filter(item => item.managerName || item.email),
      attachments: this.attachments.filter(a => a.fileName),
      ccEmails: this.ccEmails.filter(Boolean),
      terms: this.termsLines(),
      source: 'PO-NPP',
      status: 'Pending',
      selectedSupplier: this.form.selectedSupplier,
      rfqNo: this.form.rfqNo,
      prNo: this.form.prNo
    };

    this.authService.createNppPoRequest(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const saved = res?.data || payload;
        const record: PoRequest = { 
          ...saved, 
          uniqueSerialNo: res?.serialNumber || saved.uniqueSerialNo || saved.orderNo, 
          status: saved.status || 'Pending',
          amount: this.totalAmount
        };
        this.allOrders = [record, ...this.allOrders];
        this.showToast('success', `PO submitted successfully${res?.serialNumber ? ' - ' + res.serialNumber : ''}.`);
        this.view = 'list';
        this.activeTab = 'All';
        this.onSubmit.emit({ success: true, data: record });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showToast('error', err?.message || 'PO submission failed.');
      }
    });
  }

  printOrder(): void {
    window.print();
  }

  // ---------- Toast ----------
  private showToast(type: 'success' | 'error' | 'info', message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast = { type, message };
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 3500);
  }

  closeToast(): void {
    this.toast = null;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  // ---------- Utility ----------
  getStatusBadgeClass(status: string): string {
    const map: { [key: string]: string } = {
      'Approved': 'status-approved',
      'Pending': 'status-pending',
      'Rejected': 'status-rejected',
      'Draft': 'status-draft'
    };
    return map[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    return status || 'Pending';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : this.datePipe.transform(date, 'dd MMM yyyy') || dateStr;
  }

  formatAmount(amount?: number): string {
    return amount ? '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '₹0.00';
  }

  customLogo: string | null = null;
  onLogoUploaded(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.customLogo = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
}