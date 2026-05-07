import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import * as XLSX from 'xlsx';

interface NPPItem {
  _id?: string; id?: string;
  title: string; requester: string; email?: string; department: string;
  vendor?: string; amount?: number; priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected' | 'In Process';
  rfqStatus?: string; epApprovalStatus?: string; prStatus?: string;
  description?: string; requestDate?: string; category?: string;
  justification?: string; currentApprover?: string; contactNo?: string;
  organization?: string; type?: 'rfq' | 'pr' | 'po' | 'payment';
  source?: string; uniqueSerialNo?: string;
}

interface NppProcessForm {
  requesterName: string; department: string; emailId: string;
  requestDate: string; contactNo: string; organization: string;
  titleOfActivity: string; purposeAndObjective: string;
  vendor: string; amount: number; remarks: string; priority: string;
  designation?: string; paymentDueTo?: string; level?: string;
  paymentTo?: string; expenseType?: string; expenseAmount?: string;
  balanceForPayment?: string; deduction?: string; bankDetails?: string;
  sapName?: string; sapCode?: string; vendorCode?: string;
  vendorName?: string; vendorAddress?: string; vendorGst?: string;
  vendorContact?: string; vendorEmail?: string; vendorKindAttn?: string;
  orderNo?: string; orderDate?: string; quotRef?: string;
  prNo?: string; prDate?: string; purchaser?: string;
  purchaserMobile?: string; billingAddress?: string; billingGst?: string;
  shippingAddress?: string; shippingGst?: string; transporter?: string;
  taxes?: string; uniqueSerialNo?: string; rfqSerialNo?: string;
  costCenter?: string; departmentBudget?: string; balance?: string;
  cartCenter?: string; alternativeFunds?: string;
}

interface ApproverRow {
  line: 'Parallel' | 'Sequential';
  managerName: string; email: string; designation: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'In-Process';
  dateTime: string; remarks: string;
}

interface AttachmentRow {
  name: string; fileSize: string; file: File | null; remark: string; previewUrl?: string;
}

interface RfqItemRow {
  description: string; uom: string; quantity: number; make: string;
  alternative: string; vendorRef: string; remark: string;
  picture?: string; pictureFile?: File; picturePreview?: string;
}

interface RfqVendorItemRow {
  rfqNo: string; description: string; uom: string; quantity: number;
  make: string; alternative: string; currency: string;
  unitCost: number; value: number; remark: string;
}

interface PrItemRow {
  costCenter: string; supplierName: string; rfqNo: string;
  partCode: string; partDescription: string; specification: string;
  cmdt: string; uom: string; qty: number; unitPrice: number;
}

interface PoItemRow {
  partCode: string; partDescription: string; specification: string;
  hsnCode: string; instalment: string; uom: string; pcsCarton: number;
  qty: number; unitPrice: number; cgst: number; sgst: number; igst: number;
}

interface QuotationItem {
  sNo: number; rfqNo: string; partCode: string; partDescription: string;
  specification: string; uom: string; qty: number;
  supplier1Price: number; supplier1Amount: number;
  supplier2Price: number; supplier2Amount: number;
  supplier3Price: number; supplier3Amount: number;
}

interface QuotationTerms {
  gst: string; transport: string; paymentTerms: string; leadTime: string;
  attachment1: string; attachment2: string; attachment3: string;
}

interface VendorMasterRow {
  select: boolean; name: string; code: string; emailId: string;
  phoneNo: string; password: string; status: string;
  gst: string; msme: string; penCard: string; address: string; location: string;
}

interface EmployeeDetailRow {
  fullName: string; id: string; emailAddress: string; password: string;
  designation: string; department: string; contactNo: string;
  dateOfBirth: string; organization: string; reportingHead: string; reportingDesignation: string;
}

interface ItemMasterRow {
  select: boolean; cmdt: string; partCode: string; partDesc: string;
  supplier: string; location: string; price: number; uit: string; sob: string;
}

interface NewVendorDetailRow {
  vendorCode: string; supplierName: string; gstNo: string; panNo: string;
  msme: string; bankAccountNo: string; name: string; contactNo: string;
  email: string; address: string; location: string; paymentTerm: string;
}

interface CashPurchaseItem {
  itemDescription: string; purpose: string; paymentDetail: string; billInvoiceCopy: string;
}

interface WccForm {
  requesterName: string; requesterDept: string; picNameDept: string;
  vendorName: string; poWoNo: string; workCompletionDate: string;
  workDescription: string; natureOfWork: string; briefDetail: string;
  qualityNotes: string;
}

interface WccEvaluationRow {
  heads: string; wtg: number; rating: number; na: boolean; score: number; remark: string;
}

interface InvoiceRow {
  invoiceNo: string; invoiceDate: string; invoiceValue: number;
}

interface FinanceRow { text: string; }
interface DeliveryScheduleRow { text: string; }

interface OrderHistoryItem {
  uniqueSerialNo: string; type: 'rfq' | 'pr' | 'po' | 'payment';
  title: string; submittedDate: string; status: string; data: any;
}

interface ReportData {
  type: string; total: number; approved: number; rejected: number; pending: number;
}

@Component({
  selector: 'app-npp-procurement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './npp-procurement.html',
  styleUrls: ['./npp-procurement.scss']
})
export class NppProcurementComponent implements OnInit {
  activeTab: 'requisition' | 'approvals' | 'status' = 'requisition';
  activeWorkflowStep = 'requisition-vendor';
  activeProcessTab: 'cash-purchase' | 'new-vendor' | 'rfq-vendor' | 'rfq-npp' | 'vendor-list' | 'employee-detail' | 'item-master' | 'quotation-comparison' | 'pr-request-npp' | 'po-npp' | 'payment-advise' | 'wcc-npp' | 'rfq-status' | 'approval-status' = 'rfq-npp';
  showRightSidebar = false;

  workflowSteps = [
    { id: 'cash-purchase',         label: 'Cash Purchase-NPP',           tab: 'requisition' as const },
    { id: 'new-vendor',            label: 'New Vendor Approval-NPP',      tab: 'requisition' as const },
    { id: 'rfq-vendor',            label: 'Request for Quotation-NPP',    tab: 'requisition' as const },
    { id: 'requisition-vendor',    label: 'Requisition RFQ-NPP',          tab: 'requisition' as const },
    { id: 'vendor-list',           label: 'Vendor List-NPP',              tab: 'status' as const },
    { id: 'employee-detail',       label: 'Employee Detail',              tab: 'status' as const },
    { id: 'item-master',           label: 'Item Master List-NPP',         tab: 'status' as const },
    { id: 'quotation-comparison',  label: 'Quotation Cost Comparison',    tab: 'approvals' as const },
    { id: 'pr-process',            label: 'PR Request-NPP',               tab: 'approvals' as const },
    { id: 'po-approval',           label: 'PO-NPP',                       tab: 'status' as const },
    { id: 'payment-advise',        label: 'Payment Advise',               tab: 'status' as const },
    { id: 'wcc-npp',               label: 'WCC-NPP',                      tab: 'status' as const },
    { id: 'report-status',         label: 'RFQ / PR / PO Status',         tab: 'status' as const },
    { id: 'approval-status',       label: 'Approval Status',              tab: 'status' as const },
  ];

  allRequests: NPPItem[] = [];
  filteredRequests: NPPItem[] = [];
  approvalList: NPPItem[] = [];
  statusList: NPPItem[] = [];

  orderHistory: OrderHistoryItem[] = [];
  filteredOrderHistory: OrderHistoryItem[] = [];
  showOrderHistoryModal = false;
  orderHistorySearchTerm = '';
  orderHistoryDateFilter = '';

  showReportsModal = false;
  reportDateFrom = '';
  reportDateTo = '';
  reportType: 'all' | 'rfq' | 'pr' | 'po' | 'payment' = 'all';
  reportData: ReportData[] = [];
  reportSummary: any = {};

  isLoading = false;
  searchTerm = '';
  activeFilter: 'All' | 'Approved' | 'Rejected' | 'Pending' | 'In Process' = 'All';

  showCreateModal = false;
  showViewModal = false;
  showApprovalModal = false;
  selectedRequest: NPPItem | null = null;
  approvalAction: 'approve' | 'reject' = 'approve';
  approvalRemarks = '';
  isSubmitting = false;
importFileName="";
  filterPriority = '';
  filterStatus = '';
  filterDepartment = '';
  filterDate = '';
  filterVendor = '';

  formData: Partial<NPPItem> = {};
  currentUser: any = null;

  toast: { message: string; type: 'success' | 'error' | 'info' } | null = null;
  private toastTimer: any;

  priorityOptions = ['High', 'Medium', 'Low'];
  departmentOptions = ['Purchase', 'IT', 'HR', 'Finance', 'R&D', 'Operations', 'Sales', 'Production', 'Quality', 'Logistics'];
  categoryOptions = ['Equipment', 'Services', 'Software', 'Raw Material', 'Office Supplies', 'Maintenance', 'Other'];

  managerOptions = [
    { name: 'Vijay Parashar',    email: 'vijay.parashar@radiant.com',    designation: 'Manager' },
    { name: 'Ravib',             email: 'ravib@radiant.com',             designation: 'A-GM' },
    { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP' },
    { name: 'Sanjay Munshi',     email: 'sanjay.munshi@radiant.com',     designation: 'S-VP' },
    { name: 'Wang Xianwen',      email: 'wang.xianwen@radiant.com',      designation: 'GM' },
    { name: 'Raminder Singh',    email: 'raminder.singh@radiant.com',    designation: 'MD' },
  ];

  // ==================== RFQ-NPP Form ====================
  rfqNppForm: NppProcessForm = this.emptyProcessForm();
  rfqItems: RfqItemRow[] = [this.emptyRfqItem()];
  rfqApprovers: ApproverRow[] = [this.emptyApprover()];
  rfqAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  rfqCcList: string[] = [];
  rfqCcInput = '';
  rfqGeneratedSerialNo = '';
  rfqIsSubmitted = false;

  // ==================== RFQ Vendor (Request for Quotation) Form ====================
  rfqVendorForm: NppProcessForm = this.emptyProcessForm();
  rfqVendorItems: RfqVendorItemRow[] = [this.emptyRfqVendorItem()];
  rfqVendorApprovers: ApproverRow[] = [this.emptyApprover()];
  rfqVendorAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  rfqVendorCcList: string[] = [];
  rfqVendorCcInput = '';
  // ==================== EXCEL IMPORT/EXPORT METHODS ====================
  
  exportCurrentRfqExcel() {
    if (!this.rfqItems || this.rfqItems.length === 0) {
      this.showToast('No items to export', 'info');
      return;
    }
    
    const rows = this.rfqItems.map(item => ({
      'Item Description': item.description,
      'UOM': item.uom,
      'Quantity': item.quantity,
      'Make': item.make,
      'Alternative / Similar': item.alternative,
      'Vendor Ref': item.vendorRef,
      'Remark': item.remark
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Items');
    XLSX.writeFile(wb, `${this.rfqGeneratedSerialNo || 'rfq'}_export.xlsx`);
    this.showToast('Excel exported successfully', 'success');
  }

  exportRfqVendorExcel() {
    if (!this.rfqVendorItems || this.rfqVendorItems.length === 0) {
      this.showToast('No items to export', 'info');
      return;
    }
    
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
    this.showToast('Excel exported successfully', 'success');
  }

  importRfqVendorExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const imported = rows.map(row => ({
        rfqNo: row['RFQ No'] || '',
        description: row['Description'] || '',
        uom: row['UOM'] || 'Pcs',
        quantity: Number(row['Quantity'] || 1),
        make: row['Make'] || '',
        alternative: row['Alternative'] || '',
        currency: row['Currency'] || 'INR',
        unitCost: Number(row['Unit Cost'] || 0),
        value: 0,
        remark: row['Remark'] || ''
      })).filter(item => item.description);
      
      if (imported.length) {
        this.rfqVendorItems = imported;
        this.showToast(`${imported.length} item(s) imported`, 'success');
      } else {
        this.showToast('No valid items found', 'info');
      }
      input.value = '';
      this.cdr.detectChanges();
    };
    reader.readAsArrayBuffer(file);
  }

  exportPrItemsExcel() {
    if (!this.prItems || this.prItems.length === 0) {
      this.showToast('No items to export', 'info');
      return;
    }
    
    const rows = this.prItems.map(item => ({
      'Cost Center': item.costCenter,
      'Supplier Name': item.supplierName,
      'RFQ No': item.rfqNo,
      'Part Code': item.partCode,
      'Part Description': item.partDescription,
      'Specification': item.specification,
      'CMDT': item.cmdt,
      'UOM': item.uom,
      'Quantity': item.qty,
      'Unit Price': item.unitPrice,
      'Value': item.qty * item.unitPrice
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PR Items');
    XLSX.writeFile(wb, `pr_items_export.xlsx`);
    this.showToast('Excel exported successfully', 'success');
  }

  exportPoItemsExcel() {
    if (!this.poItems || this.poItems.length === 0) {
      this.showToast('No items to export', 'info');
      return;
    }
    
    const rows = this.poItems.map(item => ({
      'Part Code': item.partCode,
      'Part Description': item.partDescription,
      'Specification': item.specification,
      'HSN Code': item.hsnCode,
      'UOM': item.uom,
      'QTY': item.qty,
      'Unit Price': item.unitPrice,
      'CGST %': item.cgst,
      'SGST %': item.sgst,
      'Total Amount': (item.qty * item.unitPrice) + ((item.qty * item.unitPrice) * (item.cgst + item.sgst) / 100)
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PO Items');
    XLSX.writeFile(wb, `po_items_export.xlsx`);
    this.showToast('Excel exported successfully', 'success');
  }

  downloadPoTemplate() {
    const headers = ['Part Code', 'Part Description', 'Specification', 'HSN Code', 'UOM', 'QTY', 'Unit Price', 'CGST %', 'SGST %'];
    const sampleData = [
      ['PART-001', 'Sample Part', 'Sample Spec', '8483', 'Pcs', 10, 100, 9, 9],
      ['PART-002', 'Another Part', 'Another Spec', '8534', 'Pcs', 5, 50, 9, 9]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PO Import Template');
    XLSX.writeFile(wb, 'po_import_template.xlsx');
    this.showToast('Template downloaded', 'success');
  }

  importPoExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const imported = rows.map(row => ({
        partCode: row['Part Code'] || '',
        partDescription: row['Part Description'] || '',
        specification: row['Specification'] || '',
        hsnCode: row['HSN Code'] || '',
        instalment: row['Instalment'] || '1',
        uom: row['UOM'] || 'Pcs',
        pcsCarton: Number(row['Pcs/Carton'] || 0),
        qty: Number(row['QTY'] || 0),
        unitPrice: Number(row['Unit Price'] || 0),
        cgst: Number(row['CGST %'] || 0),
        sgst: Number(row['SGST %'] || 0),
        igst: Number(row['IGST %'] || 0)
      })).filter(item => item.partCode || item.partDescription);
      
      if (imported.length) {
        this.poItems = imported;
        this.showToast(`${imported.length} item(s) imported`, 'success');
      } else {
        this.showToast('No valid items found', 'info');
      }
      input.value = '';
      this.cdr.detectChanges();
    };
    reader.readAsArrayBuffer(file);
  }

  exportVendorListExcel() {
    const rows = this.getFilteredVendors().map(v => ({
      'Vendor Code': v.code,
      'Vendor Name': v.name,
      'Email ID': v.emailId,
      'Phone No': v.phoneNo,
      'Status': v.status
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, `vendor_list_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Vendor list exported', 'success');
  }

  exportItemMasterExcel() {
    const rows = this.getFilteredItems().map(i => ({
      'CMDT': i.cmdt,
      'Part Code': i.partCode,
      'Part Description': i.partDesc,
      'Supplier': i.supplier,
      'Location': i.location,
      'Price': i.price,
      'UIT': i.uit,
      'SOB': i.sob
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Master');
    XLSX.writeFile(wb, `item_master_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Item master exported', 'success');
  }
  // ==================== Cash Purchase Form ====================
  cashPurchaseForm: NppProcessForm = this.emptyProcessForm();
  cashPurchaseItems: CashPurchaseItem[] = [{ itemDescription: '', purpose: '', paymentDetail: '', billInvoiceCopy: '' }];
  cashPurchaseApprovers: ApproverRow[] = [this.emptyApprover()];
  cashPurchaseAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 4', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 5', fileSize: '', file: null, remark: '' },
  ];
  cashPurchaseCcList: string[] = [];
  cashPurchaseCcInput = '';
  cashPurchaseCostCenter = '';

  // ==================== New Vendor Form ====================
  newVendorForm: NppProcessForm = this.emptyProcessForm();
  newVendorDetails: NewVendorDetailRow[] = [this.emptyNewVendorDetail()];
  newVendorApprovers: ApproverRow[] = [this.emptyApprover()];
  newVendorAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: 'GST certificate' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: 'Pan Card' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: 'MSME' },
    { name: 'Attachment 4', fileSize: '', file: null, remark: 'Bank Account No.' },
    { name: 'Attachment 5', fileSize: '', file: null, remark: 'Bank Account detail' },
  ];
  newVendorCcList: string[] = [];
  newVendorCcInput = '';

  // ==================== Vendor List ====================
  vendorMasterList: VendorMasterRow[] = [
    { select: true,  name: 'Sohiab Trader',        code: 'IL2964', emailId: 'ramp@xyz', phoneNo: '9852635237', password: 'zzzzz', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Japnoor Enterprise',    code: 'IL8765', emailId: 'kps@xyz',  phoneNo: '9852635765', password: 'dddd',  status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Santhosh Electronics',  code: 'IL6789', emailId: 'ghj@xyz',  phoneNo: '9852635567', password: 'hhhh',  status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
    { select: false, name: 'Spycloud',              code: 'IL9876', emailId: 'rakt@xyz', phoneNo: '9852635988', password: 'iiiii', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' },
  ];
  vendorFilterCode = '';
  vendorFilterName = '';
  vendorFilterEmail = '';
  vendorFilterPhone = '';
  vendorFilterCmdt = '';
  vendorFilterPassword = '';

  // ==================== Employee Detail ====================
  employeeList: EmployeeDetailRow[] = [
    { fullName: 'Vijay Deep Parashar', id: '100847', emailAddress: 'vijay.parashar@radiantappliances.com', password: '123456', designation: 'Head - Purchase', department: 'Purchase', contactNo: '8806668006', dateOfBirth: '2-Feb-82', organization: 'Radiant', reportingHead: 'vijay.parashar@radiantappliances.com', reportingDesignation: 'VP-Operation' },
  ];

  // ==================== Item Master ====================
  itemMasterList: ItemMasterRow[] = [
    { select: true,  cmdt: 'Consumables',   partCode: 'RAEPL-CON-01', partDesc: 'Tape',        supplier: 'QWERT', location: 'Delhi',     price: 100, uit: 'RL',  sob: '100%' },
    { select: false, cmdt: 'ESD Material',  partCode: 'RAEPL-ESD-01', partDesc: 'Head Caps',   supplier: 'ASDFG', location: 'Hyderabad', price: 30,  uit: 'Nos', sob: '100%' },
    { select: false, cmdt: 'House Keeping', partCode: 'RAEPL-HK-01',  partDesc: 'Wire',        supplier: 'ZXCVB', location: 'Noida',     price: 20,  uit: 'Mtr', sob: '70%'  },
    { select: false, cmdt: 'Maintenance',   partCode: 'RAEPL-MNT-04', partDesc: 'Asian Paint', supplier: 'YUIOP', location: 'Pune',      price: 500, uit: 'Ltrs',sob: '30%'  },
  ];
  itemFilterPartCode = '';
  itemFilterVendor = '';
  itemFilterEmail = '';
  itemFilterPhone = '';
  itemFilterCmdt = '';
  itemFilterPassword = '';
  itemSelectedDesc = '';

  // ==================== Quotation Comparison ====================
  quotationItems: QuotationItem[] = [
    { sNo: 1, rfqNo: '', partCode: '', partDescription: 'EKTORP Two-seat sofa frame',      specification: '801.850.33', uom: 'Nos', qty: 1, supplier1Price: 20882.63, supplier1Amount: 20882.63, supplier2Price: 0,        supplier2Amount: 25460.00, supplier3Price: 0,        supplier3Amount: 23950.00 },
    { sNo: 2, rfqNo: '', partCode: '', partDescription: 'EKTORP Cover for 2-seat sofa',    specification: '905.653.58', uom: 'Nos', qty: 1, supplier1Price: 5762.71,  supplier1Amount: 5762.71,  supplier2Price: 5762.71,  supplier2Amount: 5762.71,  supplier3Price: 5762.71,  supplier3Amount: 5762.71  },
    { sNo: 3, rfqNo: '', partCode: '', partDescription: 'VITTSJO Coffee table',            specification: '506.043.47', uom: 'Nos', qty: 1, supplier1Price: 3594.49,  supplier1Amount: 3594.49,  supplier2Price: 14200,    supplier2Amount: 14200.00, supplier3Price: 0,        supplier3Amount: 16950.00 },
    { sNo: 4, rfqNo: '', partCode: '', partDescription: 'ÅRSTID Floor lamp, brass/white',  specification: '203.213.21', uom: 'Nos', qty: 1, supplier1Price: 5076.27,  supplier1Amount: 5076.27,  supplier2Price: 5076.27,  supplier2Amount: 5076.27,  supplier3Price: 5076.27,  supplier3Amount: 5076.27  },
    { sNo: 5, rfqNo: '', partCode: '', partDescription: 'SOLHETTA LED bulb E27',           specification: '704.986.52', uom: 'Nos', qty: 1, supplier1Price: 422.88,   supplier1Amount: 422.88,   supplier2Price: 422.88,   supplier2Amount: 422.88,   supplier3Price: 422.88,   supplier3Amount: 422.88   },
  ];
  quotSupplier1Name = 'IKEA INDIA PRIVATE LIMITED';
  quotSupplier2Name = 'GSK Interior';
  quotSupplier3Name = 'Modular Line Interior';
  quotTerms1: QuotationTerms = { gst: 'Extra', transport: '999', paymentTerms: '100% Against Proforma Invoice', leadTime: '', attachment1: '', attachment2: '', attachment3: '' };
  quotTerms2: QuotationTerms = { gst: 'Extra', transport: 'Extra', paymentTerms: '100% Against Proforma Invoice', leadTime: '', attachment1: '', attachment2: '', attachment3: '' };
  quotTerms3: QuotationTerms = { gst: 'Extra', transport: '4000', paymentTerms: '100% Against Proforma Invoice', leadTime: '', attachment1: '', attachment2: '', attachment3: '' };
  quotRecommendation = 'It is recommended to place the order on M/s.IKEA INDIA PRIVATE LIMITED';

  // ==================== PR Request Form ====================
  prRequestForm: NppProcessForm = this.emptyProcessForm();
  prItems: PrItemRow[] = [this.emptyPrItem()];
  prApprovers: ApproverRow[] = [this.emptyApprover()];
  prAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  prCcList: string[] = [];
  prCcInput = '';

  // ==================== PO-NPP Form ====================
  poNppForm: NppProcessForm = this.emptyProcessForm();
  poItems: PoItemRow[] = [this.emptyPoItem()];
  poApprovers: ApproverRow[] = [this.emptyApprover()];
  poAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  poCcList: string[] = [];
  poCcInput = '';
  poFinanceRows: FinanceRow[] = [
    { text: 'Ex-Work' }, { text: 'P&F' }, { text: 'Taxes' },
    { text: 'Freital charges' }, { text: 'Delivery, Schedule' },
    { text: 'Transporter' }, { text: 'Payment Term' },
  ];
  poPaymentRows: { selected: boolean; text: string }[] = [
    { selected: false, text: 'WITHIN 30 DAYS FROM THE DATE OF RECEIPT OF MATERIAL AND BILL.' },
    { selected: false, text: 'WITHIN 30 DAYS FROM THE DATE OF APPROVAL OF SAMPLES.' },
    { selected: false, text: 'WITHIN 45 DAYS FROM THE DATE OF RECEIPT OF MATERIAL AND BILL.' },
    { selected: false, text: 'WITHIN 15 DAYS FROM THE DATE OF RECEIPT OF MATERIAL AND BILL.' },
    { selected: false, text: '100% ADVANCE PAYMENT AGAINST PROFORMA INVOICE.' },
  ];
  poTerms: { text: string }[] = [
    { text: 'Please refer To Incoterm issuing in our Rocking address, as given above.' },
    { text: 'All relevant documents such as Original Invoice for Paper and Duplicated For Transporter with HSN Codes must accompany the supplies.' },
    { text: 'Vendor reference must be provided in all supply related documents.' },
    { text: 'Kindly let us know your acknowledgement on, or before given day of your compliance.' },
    { text: 'The rejection noticed if during usage on the subsequent or upon of supply, to be replaced after of week.' },
    { text: 'Supplies should be from trackable / labels and identification labels must be listed with the material.' },
    { text: 'Warranty Applicable as per respective manufacturer warranty from the date of invoice.' },
    { text: 'If at the last in compliance, Tx Invoice details in GST portal or any proposal of GST amount, M/s. RAEPL will debit to Vendor.' },
    { text: 'M/s. RAEPL will not accept any manual correction on Tax Invoice.' },
    { text: 'Applicable State level laws will supersede in jurisdiction of this order.' },
  ];
  poDeliverySchedule: DeliveryScheduleRow[] = [
    { text: 'Immediate from ready stocks.' }, { text: 'Within 2Weeks.' },
    { text: 'Within 4Weeks.' }, { text: 'Within 6Weeks.' },
    { text: 'Within 8Weeks.' }, { text: 'Within 10Days.' },
  ];

  // ==================== Payment Advise Form ====================
  paymentAdviseForm: NppProcessForm = this.emptyProcessForm();
  paymentInvoices: InvoiceRow[] = [{ invoiceNo: '', invoiceDate: '', invoiceValue: 0 }];
  paymentApprovers: ApproverRow[] = [this.emptyApprover()];
  paymentAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  paymentCcList: string[] = [];
  paymentCcInput = '';

  // ==================== WCC Form ====================
  wccForm: WccForm = {
    requesterName: '', requesterDept: '', picNameDept: '',
    vendorName: '', poWoNo: '', workCompletionDate: '',
    workDescription: '', natureOfWork: 'Fabrication', briefDetail: '',
    qualityNotes: '',
  };
  wccNatureOptions = ['Fabrication', 'Civil', 'Service', 'Maintenance', 'Others'];
  wccAcceptClose = false;
  wccAcceptWithCorrection = false;
  wccRejectRework = false;
  wccAcceptRemark = '';
  wccCorrectionRemark = '';
  wccRejectRemark = '';
  wccEvaluationRows: WccEvaluationRow[] = [
    { heads: 'Work completed as per scope / BOQ', wtg: 25, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Quality of workmanship / finishing', wtg: 10, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Compliance with approved materials/specifications', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Compliance with safety practices (PPE, barricading, permit)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Compliance with method statement / procedure (where applicable)', wtg: 5, rating: 0, na: true,  score: 0.25, remark: '' },
    { heads: 'Time adherence (planned vs actual)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Site cleanliness & housekeeping during work', wtg: 5, rating: 0, na: true,  score: 0.25, remark: '' },
    { heads: 'Management of resources/tools & availability of manpower', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Responsiveness & coordination (communication)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Issue resolution / rework handling (if any)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Material storage & handling (no wastage/damage)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Testing / inspection support provided (if applicable)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Documentation submitted (handover docs, checklists, measurement sheets)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Compliance with statutory/regulatory requirements (if applicable)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
    { heads: 'Overall workmanship reliability (defect-free / durable compliance)', wtg: 5, rating: 0, na: false, score: 0, remark: '' },
  ];
  wccApprovers: ApproverRow[] = [this.emptyApprover()];
  wccAttachments: AttachmentRow[] = [
    { name: 'Attachment 1', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 2', fileSize: '', file: null, remark: '' },
    { name: 'Attachment 3', fileSize: '', file: null, remark: '' },
  ];
  wccCcList: string[] = [];
  wccCcInput = '';

  showRequestToVendorModal = false;
  requestToVendorRfqSerialNo = '';
  requestToVendorData: any = null;
  excelFile: File | null = null;
  isImporting = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser() || {
      name: 'Deepak Kumar', email: 'dk897869@gmail.com',
      department: 'IT', contactNo: '6239785524',
      organization: 'Radiant Appliances', role: 'Manager'
    };
    this.prefillForm();
    this.prefillProcessForms();
    this.loadRequests();
    this.loadOrderHistory();
    this.generateTempSerialNumber();
  }

  private generateTempSerialNumber() {
    const timestamp = Date.now().toString().slice(-8);
    this.rfqGeneratedSerialNo = 'RFQ-TEMP-' + timestamp;
  }

  private generateUniqueSerialNumber(type: string): string {
    const prefix = type === 'rfq' ? 'RFQ' : type === 'pr' ? 'PR' : type === 'po' ? 'PO' : 'PAY';
    const d = new Date();
    const yr = d.getFullYear();
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const dy = d.getDate().toString().padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${yr}${mo}${dy}-${rand}`;
  }

  private emptyProcessForm(): NppProcessForm {
    return {
      requesterName: '', department: 'Purchase', emailId: '',
      requestDate: new Date().toISOString().split('T')[0],
      contactNo: '', organization: 'Radiant Appliances',
      titleOfActivity: '', purposeAndObjective: '',
      vendor: '', amount: 0, remarks: '', priority: 'H'
    };
  }

  private emptyApprover(): ApproverRow {
    return { line: 'Parallel', managerName: '', email: '', designation: '', status: 'Pending', dateTime: '', remarks: '' };
  }

  private emptyRfqItem(): RfqItemRow {
    return { description: '', uom: '', quantity: 0, make: '', alternative: '', vendorRef: '', remark: '' };
  }

  private emptyRfqVendorItem(): RfqVendorItemRow {
    return { rfqNo: '', description: '', uom: '', quantity: 0, make: '', alternative: '', currency: 'INR', unitCost: 0, value: 0, remark: '' };
  }

  private emptyPrItem(): PrItemRow {
    return { costCenter: '', supplierName: '', rfqNo: '', partCode: '', partDescription: '', specification: '', cmdt: '', uom: '', qty: 0, unitPrice: 0 };
  }

  private emptyPoItem(): PoItemRow {
    return { partCode: '', partDescription: '', specification: '', hsnCode: '', instalment: '', uom: '', pcsCarton: 0, qty: 0, unitPrice: 0, cgst: 0, sgst: 0, igst: 0 };
  }

  private emptyNewVendorDetail(): NewVendorDetailRow {
    return { vendorCode: '', supplierName: '', gstNo: '', panNo: '', msme: '', bankAccountNo: '', name: '', contactNo: '', email: '', address: '', location: '', paymentTerm: '' };
  }

  private prefillForm() {
    this.formData = {
      title: '', requester: this.currentUser?.name || '',
      email: this.currentUser?.email || '',
      department: this.currentUser?.department || 'Purchase',
      contactNo: this.currentUser?.contactNo || '',
      organization: this.currentUser?.organization || 'Radiant Appliances',
      vendor: '', amount: 0, priority: 'Medium', description: '',
      requestDate: new Date().toISOString().split('T')[0]
    };
  }
// Add this method to handle file input click
triggerFileUpload(index: number) {
  const fileInput = document.getElementById('pic' + index) as HTMLInputElement;
  if (fileInput) {
    fileInput.click();
  }
}
  private prefillProcessForms() {
    const base = {
      requesterName: this.currentUser?.name || '',
      department: this.currentUser?.department || 'Purchase',
      emailId: this.currentUser?.email || '',
      requestDate: new Date().toISOString().split('T')[0],
      contactNo: this.currentUser?.contactNo || '',
      organization: this.currentUser?.organization || 'Radiant Appliances'
    };
    this.rfqNppForm = { ...this.emptyProcessForm(), ...base };
    this.rfqVendorForm = { ...this.emptyProcessForm(), ...base };
    this.cashPurchaseForm = { ...this.emptyProcessForm(), ...base };
    this.newVendorForm = { ...this.emptyProcessForm(), ...base, titleOfActivity: 'Approval For: New Vendor registration' };
    this.prRequestForm = { ...this.emptyProcessForm(), ...base };
    this.poNppForm = { ...this.emptyProcessForm(), ...base, purchaser: this.currentUser?.name || '', orderDate: new Date().toISOString().split('T')[0] };
    this.paymentAdviseForm = { ...this.emptyProcessForm(), ...base };
    this.wccForm = { ...this.wccForm, requesterName: this.currentUser?.name || '', requesterDept: this.currentUser?.department || '' };
  }

  loadRequests() {
    const startedAt = Date.now();
    this.isLoading = true;
    this.authService.getNppRequests().subscribe({
      next: (res: any) => {
        let data = res?.data && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        this.allRequests = data.map((r: any) => this.mapRecord(r));
        this.applyFilters();
        setTimeout(() => { this.isLoading = false; this.showToast(`${this.allRequests.length} NPP requests loaded`, 'success'); this.cdr.detectChanges(); }, Math.max(0, 5000 - (Date.now() - startedAt)));
      },
      error: (err: any) => {
        setTimeout(() => { this.isLoading = false; this.showToast(err?.message || 'Failed to load requests', 'error'); this.cdr.detectChanges(); }, Math.max(0, 5000 - (Date.now() - startedAt)));
      }
    });
  }

  loadOrderHistory() {
    const saved = localStorage.getItem('npp_order_history');
    if (saved) {
      try { this.orderHistory = JSON.parse(saved); this.filteredOrderHistory = [...this.orderHistory]; } catch(e) {}
    }
  }

  saveOrderHistory(item: OrderHistoryItem) {
    this.orderHistory.unshift(item);
    if (this.orderHistory.length > 100) this.orderHistory = this.orderHistory.slice(0, 100);
    localStorage.setItem('npp_order_history', JSON.stringify(this.orderHistory));
    this.filteredOrderHistory = [...this.orderHistory];
  }

  filterOrderHistory() {
    let list = [...this.orderHistory];
    if (this.orderHistorySearchTerm.trim()) {
      const q = this.orderHistorySearchTerm.toLowerCase();
      list = list.filter(i => i.uniqueSerialNo.toLowerCase().includes(q) || i.title.toLowerCase().includes(q));
    }
    if (this.orderHistoryDateFilter) list = list.filter(i => i.submittedDate.startsWith(this.orderHistoryDateFilter));
    this.filteredOrderHistory = list;
  }

  openOrderHistoryModal() { this.orderHistorySearchTerm = ''; this.orderHistoryDateFilter = ''; this.filteredOrderHistory = [...this.orderHistory]; this.showOrderHistoryModal = true; }
  closeOrderHistoryModal() { this.showOrderHistoryModal = false; }

  viewOrderDetail(item: OrderHistoryItem) {
    if (item.type === 'rfq') {
      this.activeProcessTab = 'rfq-npp';
      if (item.data.rfqNppForm) this.rfqNppForm = item.data.rfqNppForm;
      if (item.data.rfqItems) this.rfqItems = item.data.rfqItems;
    } else if (item.type === 'pr') {
      this.activeProcessTab = 'pr-request-npp';
      if (item.data.prRequestForm) this.prRequestForm = item.data.prRequestForm;
      if (item.data.prItems) this.prItems = item.data.prItems;
    } else if (item.type === 'po') {
      this.activeProcessTab = 'po-npp';
      if (item.data.poNppForm) this.poNppForm = item.data.poNppForm;
      if (item.data.poItems) this.poItems = item.data.poItems;
    } else if (item.type === 'payment') {
      this.activeProcessTab = 'payment-advise';
      if (item.data.paymentAdviseForm) this.paymentAdviseForm = item.data.paymentAdviseForm;
      if (item.data.paymentInvoices) this.paymentInvoices = item.data.paymentInvoices;
    }
    this.closeOrderHistoryModal();
  }

  openReportsModal() { this.reportDateFrom = ''; this.reportDateTo = ''; this.reportType = 'all'; this.generateReports(); this.showReportsModal = true; }
  closeReportsModal() { this.showReportsModal = false; }

  generateReports() {
    let requests = [...this.allRequests];
    if (this.reportDateFrom) requests = requests.filter(r => new Date(r.requestDate || '') >= new Date(this.reportDateFrom));
    if (this.reportDateTo) requests = requests.filter(r => new Date(r.requestDate || '') <= new Date(this.reportDateTo));
    if (this.reportType !== 'all') requests = requests.filter(r => r.type === this.reportType);
    const byStatus = { total: requests.length, approved: requests.filter(r => r.status === 'Approved').length, rejected: requests.filter(r => r.status === 'Rejected').length, pending: requests.filter(r => r.status === 'Pending').length, inProcess: requests.filter(r => r.status === 'In Process').length };
    const byType: any = { rfq: { total: 0, approved: 0, rejected: 0, pending: 0 }, pr: { total: 0, approved: 0, rejected: 0, pending: 0 }, po: { total: 0, approved: 0, rejected: 0, pending: 0 }, payment: { total: 0, approved: 0, rejected: 0, pending: 0 } };
    requests.forEach(r => { const t = r.type || 'rfq'; if (byType[t]) { byType[t].total++; if (r.status === 'Approved') byType[t].approved++; else if (r.status === 'Rejected') byType[t].rejected++; else byType[t].pending++; } });
    this.reportSummary = { byStatus, byType };
    this.reportData = Object.keys(byType).map(k => ({ type: k.toUpperCase(), total: byType[k].total, approved: byType[k].approved, rejected: byType[k].rejected, pending: byType[k].pending }));
  }

  exportReportToCSV() {
    const headers = ['Type', 'Total', 'Approved', 'Rejected', 'Pending'];
    const rows = this.reportData.map(d => [d.type, d.total, d.approved, d.rejected, d.pending]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `npp_report_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  onExcelFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) { this.excelFile = file; this.importExcelData(); }
  }

  importExcelData() {
    if (!this.excelFile) return;
    this.isImporting = true;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const imported = rows.map(row => ({ description: row['Item Description'] || row.Description || '', uom: row.UOM || '', quantity: Number(row.Quantity || row.Qty || 0), make: row.Make || '', alternative: row['Alternative / Similar'] || '', vendorRef: row['Vendor Ref'] || '', remark: row.Remark || '' })).filter(i => i.description);
      if (imported.length) { this.rfqItems = imported; this.showToast(`${imported.length} items imported`, 'success'); } else { this.showToast('No items found', 'info'); }
      this.isImporting = false; this.excelFile = null; this.cdr.detectChanges();
    };
    reader.onerror = () => { this.isImporting = false; this.showToast('Import failed', 'error'); this.cdr.detectChanges(); };
    reader.readAsArrayBuffer(this.excelFile);
  }

  downloadExcelTemplate() {
    const rows = [['Item Description', 'UOM', 'Quantity', 'Make', 'Alternative', 'Vendor Ref', 'Remark'], ['Sample Item 1', 'PCS', 10, 'Make A', 'Alt B', 'REF001', 'Test remark']];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RFQ Import');
    XLSX.writeFile(wb, 'rfq_import_template.xlsx');
  }

  onPictureSelected(item: RfqItemRow, event: any) {
    const file = event.target.files[0];
    if (file) {
      item.pictureFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => { item.picturePreview = e.target.result; };
      reader.readAsDataURL(file);
    }
  }

  viewPicture(previewUrl: string) { if (previewUrl) window.open(previewUrl, '_blank'); }

  openRequestToVendorModal() { this.requestToVendorRfqSerialNo = ''; this.requestToVendorData = null; this.showRequestToVendorModal = true; }
  closeRequestToVendorModal() { this.showRequestToVendorModal = false; }

  fetchRfqDataForVendor() {
    if (!this.requestToVendorRfqSerialNo.trim()) { this.showToast('Enter RFQ Serial Number', 'error'); return; }
    const found = this.allRequests.find(r => (r as any).uniqueSerialNo === this.requestToVendorRfqSerialNo);
    if (found) {
      this.poNppForm.titleOfActivity = found.title;
      this.poNppForm.vendor = found.vendor || '';
      this.poNppForm.rfqSerialNo = this.requestToVendorRfqSerialNo;
      this.showToast('RFQ data loaded!', 'success');
      this.closeRequestToVendorModal();
      this.activeProcessTab = 'po-npp';
    } else {
      const historyItem = this.orderHistory.find(h => h.uniqueSerialNo === this.requestToVendorRfqSerialNo);
      if (historyItem) { this.showToast('RFQ loaded from history!', 'success'); this.closeRequestToVendorModal(); this.activeProcessTab = 'po-npp'; }
      else { this.showToast('RFQ Serial Number not found', 'error'); }
    }
  }

  private mapRecord(r: any): NPPItem {
    const email = this.sanitizeEmail(r.email || r.emailId || '');
    const source = r.source || '';
    return {
      _id: r._id || r.id, id: r._id || r.id,
      title: r.title || r.titleOfActivity || '—',
      requester: r.requester || r.requesterName || '—',
      email, department: r.department || '—',
      vendor: r.vendor || r.vendorName || '',
      amount: Number(r.amount ?? 0),
      priority: (r.priority === 'H' ? 'High' : r.priority === 'M' ? 'Medium' : r.priority === 'L' ? 'Low' : r.priority) || 'Medium',
      status: this.normalizeStatus(r.status),
      rfqStatus: r.rfqStatus || 'Pending',
      epApprovalStatus: r.epApprovalStatus || 'Pending',
      prStatus: r.prStatus || 'Not Started',
      description: r.description || r.purposeAndObjective || '',
      requestDate: r.requestDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      type: source.includes('PR') ? 'pr' : source.includes('PO') ? 'po' : source.includes('PAYMENT') ? 'payment' : 'rfq',
      source, uniqueSerialNo: r.uniqueSerialNo
    };
  }

  private sanitizeEmail(email: string): string {
    const v = (email || '').trim();
    return (!v || /^[a-f0-9]{24}$/i.test(v)) ? '' : v;
  }

  private normalizeStatus(status: string): NPPItem['status'] {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'in-process' || s === 'in process') return 'In Process';
    return 'Pending';
  }

  applyFilters() {
    let list = [...this.allRequests];
    if (this.activeFilter !== 'All') list = list.filter(r => r.status === this.activeFilter);
    if (this.searchTerm.trim()) { const q = this.searchTerm.toLowerCase(); list = list.filter(r => r.title?.toLowerCase().includes(q) || r.requester?.toLowerCase().includes(q)); }
    this.filteredRequests = list;
    this.approvalList = [...this.allRequests];
    this.statusList = [...this.allRequests];
    this.cdr.detectChanges();
  }

  setTab(tab: 'requisition' | 'approvals' | 'status') { this.activeTab = tab; this.applyFilters(); }

  setWorkflowStep(stepId: string) {
    const step = this.workflowSteps.find(s => s.id === stepId);
    if (!step) return;
    this.activeWorkflowStep = step.id;
    this.activeTab = step.tab;
    const tabMap: any = {
      'cash-purchase': 'cash-purchase', 'new-vendor': 'new-vendor',
      'rfq-vendor': 'rfq-vendor', 'requisition-vendor': 'rfq-npp',
      'vendor-list': 'vendor-list', 'employee-detail': 'employee-detail',
      'item-master': 'item-master', 'quotation-comparison': 'quotation-comparison',
      'pr-process': 'pr-request-npp', 'po-approval': 'po-npp',
      'payment-advise': 'payment-advise', 'wcc-npp': 'wcc-npp',
      'report-status': 'rfq-status', 'approval-status': 'approval-status',
    };
    if (tabMap[stepId]) this.activeProcessTab = tabMap[stepId];
    this.applyFilters();
  }

  getActiveWorkflowLabel(): string { return this.workflowSteps.find(s => s.id === this.activeWorkflowStep)?.label || 'Requisition'; }

  setProcessTab(tab: any) {
    this.activeProcessTab = tab;
    const stepMap: any = { 'rfq-npp': 'requisition-vendor', 'pr-request-npp': 'pr-process', 'po-npp': 'po-approval', 'payment-advise': 'payment-advise', 'cash-purchase': 'cash-purchase', 'new-vendor': 'new-vendor', 'rfq-vendor': 'rfq-vendor', 'vendor-list': 'vendor-list', 'employee-detail': 'employee-detail', 'item-master': 'item-master', 'quotation-comparison': 'quotation-comparison', 'wcc-npp': 'wcc-npp' };
    if (stepMap[tab]) this.activeWorkflowStep = stepMap[tab];
  }

  setFilter(filter: 'All' | 'Approved' | 'Rejected' | 'Pending' | 'In Process') { this.activeFilter = filter; this.applyFilters(); }
  onSearch() { this.applyFilters(); }
  countByStatus(status: string): number { return status === 'All' ? this.allRequests.length : this.allRequests.filter(r => r.status === status).length; }

  // ==================== RFQ METHODS ====================
  addRfqItem() { this.rfqItems.push(this.emptyRfqItem()); }
  removeRfqItem(i: number) { if (this.rfqItems.length > 1) this.rfqItems.splice(i, 1); }
  addRfqApprover() { this.rfqApprovers.push(this.emptyApprover()); }
  removeRfqApprover(i: number) { if (this.rfqApprovers.length > 1) this.rfqApprovers.splice(i, 1); }
  onRfqManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  onRfqEmailChange(ap: ApproverRow, email: string) { const m = this.managerOptions.find(x => x.email === email); if (m) { ap.managerName = m.name; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addRfqCc() { const e = this.rfqCcInput.trim(); if (e && e.includes('@') && !this.rfqCcList.includes(e)) { this.rfqCcList.push(e); this.rfqCcInput = ''; } }
  addMultipleRfqCcs(event: any) { const pasted = event.clipboardData.getData('text'); if (pasted) { pasted.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.rfqCcList.includes(t)) this.rfqCcList.push(t); }); this.rfqCcInput = ''; event.preventDefault(); } }
  removeRfqCc(i: number) { this.rfqCcList.splice(i, 1); }
  onRfqFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); if (file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e: any) => { att.previewUrl = e.target.result; this.cdr.detectChanges(); }; reader.readAsDataURL(file); } } }

  saveRfqDraft() {
    try { localStorage.setItem('npp_rfq_draft', JSON.stringify({ rfqNppForm: this.rfqNppForm, rfqItems: this.rfqItems, rfqApprovers: this.rfqApprovers, rfqCcList: this.rfqCcList, savedAt: new Date().toISOString(), uniqueSerialNo: this.rfqGeneratedSerialNo })); this.showToast('RFQ draft saved!', 'success'); } catch { this.showToast('Failed to save draft', 'error'); }
  }

  loadRfqDraft() {
    const saved = localStorage.getItem('npp_rfq_draft');
    if (saved) { try { const d = JSON.parse(saved); if (d.rfqNppForm) this.rfqNppForm = d.rfqNppForm; if (d.rfqItems) this.rfqItems = d.rfqItems; if (d.rfqApprovers) this.rfqApprovers = d.rfqApprovers; if (d.rfqCcList) this.rfqCcList = d.rfqCcList; this.showToast('Draft loaded!', 'success'); } catch(e) { this.showToast('Failed to load draft', 'error'); } } else { this.showToast('No draft found', 'info'); }
  }

  previewRfqNpp() {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const itemsHtml = this.rfqItems.map((it, i) => `<tr><td>${i+1}</td><td>${it.description}</td><td>${it.uom}</td><td>${it.quantity}</td><td>${it.make}</td><td>${it.alternative}</td><td>${it.vendorRef}</td><td>${it.remark}</td></tr>`).join('');
    pw.document.write(`<!DOCTYPE html><html><head><title>RFQ-NPP Preview</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}td,th{border:1px solid #ccc;padding:6px;}th{background:#f0f4f8;font-weight:bold;}.header{text-align:center;font-weight:bold;font-size:16px;margin-bottom:8px;}</style></head><body><div class="header">Procurement (NON-BOM) - Requisition (Request for Quotation)</div><p><strong>Serial No:</strong> ${this.rfqGeneratedSerialNo}</p><table><tr><td><strong>Name:</strong> ${this.rfqNppForm.requesterName}</td><td><strong>Request Date:</strong> ${this.rfqNppForm.requestDate}</td></tr><tr><td><strong>Department:</strong> ${this.rfqNppForm.department}</td><td><strong>Contact No.:</strong> ${this.rfqNppForm.contactNo}</td></tr><tr><td><strong>Email ID:</strong> ${this.rfqNppForm.emailId}</td><td><strong>Organization:</strong> ${this.rfqNppForm.organization}</td></tr></table><table><thead><tr><th>#</th><th>Description</th><th>UOM</th><th>Qty</th><th>Make</th><th>Alternative</th><th>Vendor Ref</th><th>Remark</th></tr></thead><tbody>${itemsHtml}</tbody></table><button onclick="window.print()">Print</button></body></html>`);
    pw.document.close();
  }

  submitRfqNppSheet() {
    if (!this.rfqNppForm.titleOfActivity.trim()) { this.showToast('Title of Activity is required.', 'error'); return; }
    this.isSubmitting = true;
    const finalSerialNo = this.generateUniqueSerialNumber('rfq');
    this.rfqGeneratedSerialNo = finalSerialNo;
    this.rfqIsSubmitted = true;
    const payload = { ...this.rfqNppForm, items: this.rfqItems, stakeholders: this.rfqApprovers, ccList: this.rfqCcList, source: 'RFQ-NPP', status: 'Pending', uniqueSerialNo: finalSerialNo };
    this.authService.createNppRequest(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saveOrderHistory({ uniqueSerialNo: finalSerialNo, type: 'rfq', title: this.rfqNppForm.titleOfActivity, submittedDate: new Date().toISOString(), status: 'Pending', data: { rfqNppForm: this.rfqNppForm, rfqItems: this.rfqItems, rfqApprovers: this.rfqApprovers, rfqCcList: this.rfqCcList } });
        this.loadRequests(); this.showToast(`RFQ submitted! Serial: ${finalSerialNo}`, 'success');
        this.rfqNppForm = this.emptyProcessForm(); this.rfqItems = [this.emptyRfqItem()]; this.rfqApprovers = [this.emptyApprover()]; this.rfqCcList = [];
        this.generateTempSerialNumber(); this.rfqIsSubmitted = false;
      },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== RFQ VENDOR METHODS ====================
  addRfqVendorItem() { this.rfqVendorItems.push(this.emptyRfqVendorItem()); }
  removeRfqVendorItem(i: number) { if (this.rfqVendorItems.length > 1) this.rfqVendorItems.splice(i, 1); }
  calcRfqVendorValue(item: RfqVendorItemRow) { item.value = item.quantity * item.unitCost; }
  getRfqVendorTotal(): number { return this.rfqVendorItems.reduce((s, i) => s + i.value, 0); }
  addRfqVendorApprover() { this.rfqVendorApprovers.push(this.emptyApprover()); }
  removeRfqVendorApprover(i: number) { if (this.rfqVendorApprovers.length > 1) this.rfqVendorApprovers.splice(i, 1); }
  onRfqVendorManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addRfqVendorCc() { const e = this.rfqVendorCcInput.trim(); if (e && e.includes('@') && !this.rfqVendorCcList.includes(e)) { this.rfqVendorCcList.push(e); this.rfqVendorCcInput = ''; } }
  removeRfqVendorCc(i: number) { this.rfqVendorCcList.splice(i, 1); }
  addMultipleRfqVendorCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.rfqVendorCcList.includes(t)) this.rfqVendorCcList.push(t); }); this.rfqVendorCcInput = ''; event.preventDefault(); } }
  onRfqVendorFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  submitRfqVendorSheet() {
    if (!this.rfqVendorForm.titleOfActivity.trim()) { this.showToast('Title is required', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('rfq');
    const payload = { ...this.rfqVendorForm, items: this.rfqVendorItems, stakeholders: this.rfqVendorApprovers, ccList: this.rfqVendorCcList, source: 'RFQ-VENDOR', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppRequest(payload).subscribe({
      next: () => { this.isSubmitting = false; this.showToast(`Request for Quotation submitted! Serial: ${sn}`, 'success'); },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== CASH PURCHASE METHODS ====================
  addCashPurchaseItem() { this.cashPurchaseItems.push({ itemDescription: '', purpose: '', paymentDetail: '', billInvoiceCopy: '' }); }
  removeCashPurchaseItem(i: number) { if (this.cashPurchaseItems.length > 1) this.cashPurchaseItems.splice(i, 1); }
  addCashPurchaseApprover() { this.cashPurchaseApprovers.push(this.emptyApprover()); }
  removeCashPurchaseApprover(i: number) { if (this.cashPurchaseApprovers.length > 1) this.cashPurchaseApprovers.splice(i, 1); }
  onCashPurchaseManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addCashPurchaseCc() { const e = this.cashPurchaseCcInput.trim(); if (e && e.includes('@') && !this.cashPurchaseCcList.includes(e)) { this.cashPurchaseCcList.push(e); this.cashPurchaseCcInput = ''; } }
  removeCashPurchaseCc(i: number) { this.cashPurchaseCcList.splice(i, 1); }
  addMultipleCashPurchaseCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.cashPurchaseCcList.includes(t)) this.cashPurchaseCcList.push(t); }); this.cashPurchaseCcInput = ''; event.preventDefault(); } }
  onCashPurchaseFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  submitCashPurchaseSheet() {
    if (!this.cashPurchaseForm.titleOfActivity.trim()) { this.showToast('Title is required', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('pr');
    const payload = { ...this.cashPurchaseForm, items: this.cashPurchaseItems, stakeholders: this.cashPurchaseApprovers, ccList: this.cashPurchaseCcList, source: 'CASH-PURCHASE-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppRequest(payload).subscribe({
      next: () => { this.isSubmitting = false; this.showToast(`Cash Purchase submitted! Serial: ${sn}`, 'success'); },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== NEW VENDOR METHODS ====================
  addNewVendorDetail() { this.newVendorDetails.push(this.emptyNewVendorDetail()); }
  removeNewVendorDetail(i: number) { if (this.newVendorDetails.length > 1) this.newVendorDetails.splice(i, 1); }
  addNewVendorApprover() { this.newVendorApprovers.push(this.emptyApprover()); }
  removeNewVendorApprover(i: number) { if (this.newVendorApprovers.length > 1) this.newVendorApprovers.splice(i, 1); }
  onNewVendorManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addNewVendorCc() { const e = this.newVendorCcInput.trim(); if (e && e.includes('@') && !this.newVendorCcList.includes(e)) { this.newVendorCcList.push(e); this.newVendorCcInput = ''; } }
  removeNewVendorCc(i: number) { this.newVendorCcList.splice(i, 1); }
  addMultipleNewVendorCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.newVendorCcList.includes(t)) this.newVendorCcList.push(t); }); this.newVendorCcInput = ''; event.preventDefault(); } }
  onNewVendorFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  submitNewVendorSheet() {
    if (!this.newVendorForm.titleOfActivity.trim()) { this.showToast('Title is required', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('rfq');
    const payload = { ...this.newVendorForm, vendorDetails: this.newVendorDetails, stakeholders: this.newVendorApprovers, ccList: this.newVendorCcList, source: 'NEW-VENDOR-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppRequest(payload).subscribe({
      next: () => { this.isSubmitting = false; this.showToast(`New Vendor Approval submitted! Serial: ${sn}`, 'success'); },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== VENDOR LIST METHODS ====================
  getFilteredVendors(): VendorMasterRow[] {
    return this.vendorMasterList.filter(v =>
      (!this.vendorFilterCode || v.code.toLowerCase().includes(this.vendorFilterCode.toLowerCase())) &&
      (!this.vendorFilterName || v.name.toLowerCase().includes(this.vendorFilterName.toLowerCase())) &&
      (!this.vendorFilterEmail || v.emailId.toLowerCase().includes(this.vendorFilterEmail.toLowerCase())) &&
      (!this.vendorFilterPhone || v.phoneNo.includes(this.vendorFilterPhone))
    );
  }
  saveVendorRow(v: VendorMasterRow) { this.showToast(`Vendor "${v.name}" saved`, 'success'); }
  addVendorRow() { this.vendorMasterList.push({ select: false, name: '', code: '', emailId: '', phoneNo: '', password: '', status: 'Active', gst: '', msme: '', penCard: '', address: '', location: '' }); }

  // ==================== ITEM MASTER METHODS ====================
  getFilteredItems(): ItemMasterRow[] {
    return this.itemMasterList.filter(i =>
      (!this.itemFilterPartCode || i.partCode.toLowerCase().includes(this.itemFilterPartCode.toLowerCase())) &&
      (!this.itemFilterVendor || i.supplier.toLowerCase().includes(this.itemFilterVendor.toLowerCase())) &&
      (!this.itemFilterCmdt || i.cmdt.toLowerCase().includes(this.itemFilterCmdt.toLowerCase()))
    );
  }
  addItemMasterRow() { this.itemMasterList.push({ select: false, cmdt: '', partCode: '', partDesc: '', supplier: '', location: '', price: 0, uit: '', sob: '' }); }
  selectItem(item: ItemMasterRow) { this.itemSelectedDesc = item.partDesc; item.select = !item.select; }

  // ==================== QUOTATION METHODS ====================
  getQuotTotals() {
    return { t1: this.quotationItems.reduce((s, i) => s + i.supplier1Amount, 0), t2: this.quotationItems.reduce((s, i) => s + i.supplier2Amount, 0), t3: this.quotationItems.reduce((s, i) => s + i.supplier3Amount, 0) };
  }
  addQuotationItem() { this.quotationItems.push({ sNo: this.quotationItems.length + 1, rfqNo: '', partCode: '', partDescription: '', specification: '', uom: '', qty: 0, supplier1Price: 0, supplier1Amount: 0, supplier2Price: 0, supplier2Amount: 0, supplier3Price: 0, supplier3Amount: 0 }); }
  removeQuotationItem(i: number) { if (this.quotationItems.length > 1) this.quotationItems.splice(i, 1); }
  calcQuotAmounts(item: QuotationItem) { item.supplier1Amount = item.qty * item.supplier1Price; item.supplier2Amount = item.qty * item.supplier2Price; item.supplier3Amount = item.qty * item.supplier3Price; }

  // ==================== PR METHODS ====================
  addPrItem() { this.prItems.push(this.emptyPrItem()); }
  removePrItem(i: number) { if (this.prItems.length > 1) this.prItems.splice(i, 1); }
  getPrTotal(): number { return this.prItems.reduce((s, it) => s + (it.qty * it.unitPrice), 0); }
  addPrApprover() { this.prApprovers.push(this.emptyApprover()); }
  removePrApprover(i: number) { if (this.prApprovers.length > 1) this.prApprovers.splice(i, 1); }
  onPrManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  onPrEmailChange(ap: ApproverRow, email: string) { const m = this.managerOptions.find(x => x.email === email); if (m) { ap.managerName = m.name; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addPrCc() { const e = this.prCcInput.trim(); if (e && e.includes('@') && !this.prCcList.includes(e)) { this.prCcList.push(e); this.prCcInput = ''; } }
  addMultiplePrCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.prCcList.includes(t)) this.prCcList.push(t); }); this.prCcInput = ''; event.preventDefault(); } }
  removePrCc(i: number) { this.prCcList.splice(i, 1); }
  onPrFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  savePrDraft() { try { localStorage.setItem('npp_pr_draft', JSON.stringify({ prRequestForm: this.prRequestForm, prItems: this.prItems, prApprovers: this.prApprovers, prCcList: this.prCcList, savedAt: new Date().toISOString() })); this.showToast('PR draft saved!', 'success'); } catch { this.showToast('Failed to save draft', 'error'); } }
  loadPrDraft() { const s = localStorage.getItem('npp_pr_draft'); if (s) { try { const d = JSON.parse(s); if (d.prRequestForm) this.prRequestForm = d.prRequestForm; if (d.prItems) this.prItems = d.prItems; if (d.prApprovers) this.prApprovers = d.prApprovers; if (d.prCcList) this.prCcList = d.prCcList; this.showToast('PR draft loaded!', 'success'); } catch(e) { this.showToast('Failed to load draft', 'error'); } } else { this.showToast('No draft found', 'info'); } }

  submitPrRequestSheet() {
    if (!this.prRequestForm.titleOfActivity.trim()) { this.showToast('Title is required.', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('pr');
    const payload = { ...this.prRequestForm, items: this.prItems, stakeholders: this.prApprovers, ccList: this.prCcList, source: 'PR-REQUEST-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppPrRequest(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saveOrderHistory({ uniqueSerialNo: sn, type: 'pr', title: this.prRequestForm.titleOfActivity, submittedDate: new Date().toISOString(), status: 'Pending', data: { prRequestForm: this.prRequestForm, prItems: this.prItems, prApprovers: this.prApprovers, prCcList: this.prCcList } });
        this.loadRequests(); this.showToast(`PR submitted! Serial: ${sn}`, 'success');
        this.prRequestForm = this.emptyProcessForm(); this.prItems = [this.emptyPrItem()]; this.prApprovers = [this.emptyApprover()]; this.prCcList = [];
      },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== PO METHODS ====================
  addPoItem() { this.poItems.push(this.emptyPoItem()); }
  removePoItem(i: number) { if (this.poItems.length > 1) this.poItems.splice(i, 1); }
  getPoGstAmount(item: PoItemRow): number { return item.qty * item.unitPrice * ((item.cgst + item.sgst + item.igst) / 100); }
  getPoTotal(item: PoItemRow): number { return item.qty * item.unitPrice + this.getPoGstAmount(item); }
  getPoGrandGst(): number { return this.poItems.reduce((s, it) => s + this.getPoGstAmount(it), 0); }
  getPoGrandTotal(): number { return this.poItems.reduce((s, it) => s + this.getPoTotal(it), 0); }
  addPoApprover() { this.poApprovers.push(this.emptyApprover()); }
  removePoApprover(i: number) { if (this.poApprovers.length > 1) this.poApprovers.splice(i, 1); }
  onPoManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  onPoEmailChange(ap: ApproverRow, email: string) { const m = this.managerOptions.find(x => x.email === email); if (m) { ap.managerName = m.name; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addPoCc() { const e = this.poCcInput.trim(); if (e && e.includes('@') && !this.poCcList.includes(e)) { this.poCcList.push(e); this.poCcInput = ''; } }
  addMultiplePoCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.poCcList.includes(t)) this.poCcList.push(t); }); this.poCcInput = ''; event.preventDefault(); } }
  removePoCc(i: number) { this.poCcList.splice(i, 1); }
  onPoFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  addPoTerm() { this.poTerms.push({ text: '' }); }
  removePoTerm(i: number) { if (this.poTerms.length > 1) this.poTerms.splice(i, 1); }
  getTermLetter(i: number): string { return String.fromCharCode(65 + i); }
  addDeliverySlot() { this.poDeliverySchedule.push({ text: '' }); }
  removeDeliverySlot(i: number) { if (this.poDeliverySchedule.length > 1) this.poDeliverySchedule.splice(i, 1); }
  addFinanceRow() { this.poFinanceRows.push({ text: '' }); }
  removeFinanceRow(i: number) { if (this.poFinanceRows.length > 1) this.poFinanceRows.splice(i, 1); }
  savePoDraft() { try { localStorage.setItem('npp_po_draft', JSON.stringify({ poNppForm: this.poNppForm, poItems: this.poItems, poApprovers: this.poApprovers, poCcList: this.poCcList, savedAt: new Date().toISOString() })); this.showToast('PO draft saved!', 'success'); } catch { this.showToast('Failed to save draft', 'error'); } }

  submitPoNppSheet() {
    if (!this.poNppForm.titleOfActivity?.trim() && !this.poNppForm.vendorName?.trim()) { this.showToast('Please fill vendor name or title.', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('po');
    const payload = { ...this.poNppForm, items: this.poItems, stakeholders: this.poApprovers, ccList: this.poCcList, terms: this.poTerms, financeRows: this.poFinanceRows, deliverySchedule: this.poDeliverySchedule, source: 'PO-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppPoRequest(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saveOrderHistory({ uniqueSerialNo: sn, type: 'po', title: this.poNppForm.titleOfActivity || this.poNppForm.vendorName || '', submittedDate: new Date().toISOString(), status: 'Pending', data: { poNppForm: this.poNppForm, poItems: this.poItems, poApprovers: this.poApprovers, poCcList: this.poCcList } });
        this.loadRequests(); this.showToast(`PO submitted! Serial: ${sn}`, 'success');
        this.poNppForm = this.emptyProcessForm(); this.poItems = [this.emptyPoItem()]; this.poApprovers = [this.emptyApprover()]; this.poCcList = [];
      },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== PAYMENT METHODS ====================
  addInvoice() { this.paymentInvoices.push({ invoiceNo: '', invoiceDate: '', invoiceValue: 0 }); }
  removeInvoice(i: number) { if (this.paymentInvoices.length > 1) this.paymentInvoices.splice(i, 1); }
  getInvoiceTotal(): number { return this.paymentInvoices.reduce((s, inv) => s + (Number(inv.invoiceValue) || 0), 0); }
  addPaymentApprover() { this.paymentApprovers.push(this.emptyApprover()); }
  removePaymentApprover(i: number) { if (this.paymentApprovers.length > 1) this.paymentApprovers.splice(i, 1); }
  onPaymentManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  onPaymentEmailChange(ap: ApproverRow, email: string) { const m = this.managerOptions.find(x => x.email === email); if (m) { ap.managerName = m.name; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addPaymentCc() { const e = this.paymentCcInput.trim(); if (e && e.includes('@') && !this.paymentCcList.includes(e)) { this.paymentCcList.push(e); this.paymentCcInput = ''; } }
  addMultiplePaymentCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.paymentCcList.includes(t)) this.paymentCcList.push(t); }); this.paymentCcInput = ''; event.preventDefault(); } }
  removePaymentCc(i: number) { this.paymentCcList.splice(i, 1); }
  onPaymentFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  savePaymentDraft() { try { localStorage.setItem('npp_payment_draft', JSON.stringify({ paymentAdviseForm: this.paymentAdviseForm, paymentInvoices: this.paymentInvoices, paymentApprovers: this.paymentApprovers, paymentCcList: this.paymentCcList, savedAt: new Date().toISOString() })); this.showToast('Payment draft saved!', 'success'); } catch { this.showToast('Failed to save draft', 'error'); } }

  submitPaymentAdviseSheet() {
    if (!this.paymentAdviseForm.titleOfActivity?.trim() && !this.paymentAdviseForm.paymentTo?.trim()) { this.showToast('Payment subject/title is required.', 'error'); return; }
    this.isSubmitting = true;
    const sn = this.generateUniqueSerialNumber('payment');
    const payload = { ...this.paymentAdviseForm, invoices: this.paymentInvoices, stakeholders: this.paymentApprovers, ccList: this.paymentCcList, source: 'PAYMENT-ADVISE-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createPaymentAdviceRequest(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saveOrderHistory({ uniqueSerialNo: sn, type: 'payment', title: this.paymentAdviseForm.titleOfActivity || this.paymentAdviseForm.paymentTo || '', submittedDate: new Date().toISOString(), status: 'Pending', data: { paymentAdviseForm: this.paymentAdviseForm, paymentInvoices: this.paymentInvoices, paymentApprovers: this.paymentApprovers, paymentCcList: this.paymentCcList } });
        this.loadRequests(); this.showToast(`Payment Advise submitted! Serial: ${sn}`, 'success');
        this.paymentAdviseForm = this.emptyProcessForm(); this.paymentInvoices = [{ invoiceNo: '', invoiceDate: '', invoiceValue: 0 }]; this.paymentApprovers = [this.emptyApprover()]; this.paymentCcList = [];
      },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== WCC METHODS ====================
  getWccTtlScore(): number { return this.wccEvaluationRows.reduce((s, r) => s + r.score, 0); }
  getWccOverallRating(): string {
    const score = this.getWccTtlScore();
    if (score >= 4) return '5 - Excellent'; if (score >= 3) return '4 - Good'; if (score >= 2) return '3 - Satisfactory'; if (score >= 1) return '2 - Needs Improvement'; return '1 - Poor';
  }
  calcWccScore(row: WccEvaluationRow) { row.score = row.na ? row.wtg * 0.05 : row.rating * row.wtg / 100; }
  addWccApprover() { this.wccApprovers.push(this.emptyApprover()); }
  removeWccApprover(i: number) { if (this.wccApprovers.length > 1) this.wccApprovers.splice(i, 1); }
  onWccManagerChange(ap: ApproverRow, name: string) { const m = this.managerOptions.find(x => x.name === name); if (m) { ap.email = m.email; ap.designation = m.designation; ap.dateTime = new Date().toLocaleString(); } }
  addWccCc() { const e = this.wccCcInput.trim(); if (e && e.includes('@') && !this.wccCcList.includes(e)) { this.wccCcList.push(e); this.wccCcInput = ''; } }
  removeWccCc(i: number) { this.wccCcList.splice(i, 1); }
  addMultipleWccCcs(event: any) { const p = event.clipboardData.getData('text'); if (p) { p.split(/[;, \n]+/).filter((e: string) => e.includes('@')).forEach((email: string) => { const t = email.trim(); if (!this.wccCcList.includes(t)) this.wccCcList.push(t); }); this.wccCcInput = ''; event.preventDefault(); } }
  onWccFileSelected(att: AttachmentRow, event: any) { const file = event.target.files[0]; if (file) { att.file = file; att.fileSize = this.formatFileSize(file.size); } }
  submitWccSheet() {
    if (!this.wccForm.vendorName.trim()) { this.showToast('Vendor name is required', 'error'); return; }
    this.isSubmitting = true;
    const sn = `WCC-${Date.now()}`;
    const payload = { ...this.wccForm, evaluationRows: this.wccEvaluationRows, stakeholders: this.wccApprovers, ccList: this.wccCcList, source: 'WCC-NPP', status: 'Pending', uniqueSerialNo: sn };
    this.authService.createNppRequest(payload).subscribe({
      next: () => { this.isSubmitting = false; this.showToast(`WCC submitted! Serial: ${sn}`, 'success'); },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to submit', 'error'); }
    });
  }

  // ==================== CRUD MODALS ====================
  openCreateModal() { this.prefillForm(); this.showCreateModal = true; }
  closeCreateModal() { this.showCreateModal = false; }

  submitRequest() {
    if (!this.formData.title?.trim()) { this.showToast('Title is required', 'error'); return; }
    this.isSubmitting = true;
    const payload = { title: this.formData.title, requesterName: this.formData.requester, emailId: this.formData.email, department: this.formData.department, contactNo: this.formData.contactNo, organization: this.formData.organization, vendor: this.formData.vendor, amount: this.formData.amount, priority: this.formData.priority === 'High' ? 'H' : this.formData.priority === 'Medium' ? 'M' : 'L', description: this.formData.description, requestDate: this.formData.requestDate, status: 'Pending' };
    this.authService.createNppRequest(payload).subscribe({
      next: (res: any) => { const newItem = res?.data || res; this.allRequests.unshift(this.mapRecord(newItem)); this.applyFilters(); this.showCreateModal = false; this.isSubmitting = false; this.showToast('NPP request created!', 'success'); this.cdr.detectChanges(); },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || 'Failed to create', 'error'); this.cdr.detectChanges(); }
    });
  }

  viewRequest(request: NPPItem) { this.selectedRequest = request; this.showViewModal = true; }
  closeViewModal() { this.showViewModal = false; this.selectedRequest = null; }

  openApprovalModal(request: NPPItem, action: 'approve' | 'reject') { this.selectedRequest = request; this.approvalAction = action; this.approvalRemarks = ''; this.showApprovalModal = true; }
  closeApprovalModal() { this.showApprovalModal = false; this.selectedRequest = null; this.approvalRemarks = ''; }

  submitApproval() {
    if (!this.approvalRemarks.trim()) { this.showToast('Please provide remarks', 'error'); return; }
    this.isSubmitting = true;
    const id = this.selectedRequest?._id || this.selectedRequest?.id;
    if (!id) { this.showToast('Invalid request ID', 'error'); return; }
    const action$ = this.approvalAction === 'approve' ? this.authService.approveNppRequest(id, this.approvalRemarks) : this.authService.rejectNppRequest(id, this.approvalRemarks);
    action$.subscribe({
      next: () => {
        if (this.selectedRequest) { this.selectedRequest.status = this.approvalAction === 'approve' ? 'Approved' : 'Rejected'; const index = this.allRequests.findIndex(r => (r._id || r.id) === id); if (index !== -1) this.allRequests[index].status = this.selectedRequest.status; }
        this.applyFilters(); this.closeApprovalModal(); this.isSubmitting = false; this.showToast(`Request ${this.approvalAction}d!`, 'success'); this.cdr.detectChanges();
      },
      error: (err: any) => { this.isSubmitting = false; this.showToast(err?.message || `Failed to ${this.approvalAction}`, 'error'); this.cdr.detectChanges(); }
    });
  }

  // ==================== UTILS ====================
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  formatAmount(amount?: number): string { return amount ? '₹' + amount.toLocaleString('en-IN') : '₹0'; }

  getPriorityClass(priority: string): string {
    const p = (priority || 'Medium').toLowerCase();
    if (p === 'high') return 'high'; if (p === 'low') return 'low'; return 'medium';
  }

  getStatusClass(status: string): string {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'approved') return 'approved'; if (s === 'rejected') return 'rejected'; if (s === 'in-process' || s === 'in process') return 'in-process'; return 'pending';
  }

  isAdminOrManager(): boolean { const role = this.authService.getUserRole(); return role === 'Admin' || role === 'Manager'; }

  showToast(message: string, type: 'success' | 'error' | 'info') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = { message, type };
    this.toastTimer = setTimeout(() => { this.toast = null; this.cdr.detectChanges(); }, 5000);
  }

  closeToast() { this.toast = null; if (this.toastTimer) clearTimeout(this.toastTimer); }
  trackById(index: number, item: NPPItem) { return item._id || item.id || index; }
}