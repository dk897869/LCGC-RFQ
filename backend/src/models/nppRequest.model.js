const mongoose = require('mongoose');

const nppRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['cash-purchase', 'new-vendor', 'rfq-vendor', 'rfq-requisition', 
           'vendor-list', 'employee-detail', 'item-master', 'quotation-comparison',
           'pr-request', 'po-npp', 'payment-advise', 'wcc-npp'],
    required: true
  },
  uniqueSerialNo: { type: String, unique: true, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  
  // Requester Information
  requesterName: { type: String, required: true },
  department: { type: String, required: true },
  emailId: { type: String, required: true },
  requestDate: { type: Date, default: Date.now },
  contactNo: { type: String },
  organization: { type: String },
  titleOfActivity: { type: String },
  priority: { type: String, enum: ['H', 'M', 'L'], default: 'M' },
  purposeAndObjective: { type: String },
  
  // Cash Purchase specific
  costCenter: { type: String },
  cashPurchaseItems: [{
    itemDescription: String,
    purpose: String,
    paymentDetail: String,
    billInvoiceCopy: String
  }],
  
  // New Vendor specific
  vendorDetails: [{
    vendorCode: String,
    supplierName: String,
    gstNo: String,
    panNo: String,
    msme: String,
    bankAccountNo: String,
    name: String,
    contactNo: String,
    email: String,
    address: String,
    location: String,
    paymentTerm: String
  }],
  
  // RFQ Vendor specific
  rfqVendorItems: [{
    rfqNo: String,
    description: String,
    uom: String,
    quantity: Number,
    make: String,
    alternative: String,
    currency: String,
    unitCost: Number,
    value: Number,
    remark: String
  }],
  
  // RFQ Requisition specific
  rfqItems: [{
    description: String,
    uom: String,
    quantity: Number,
    make: String,
    alternative: String,
    vendorRef: String,
    remark: String,
    pictureUrl: String
  }],
  
  // Vendor List specific
  vendorList: [{
    vendorCode: String,
    vendorName: String,
    emailId: String,
    phoneNo: String,
    status: String,
    gst: String,
    msme: String,
    address: String,
    location: String
  }],
  
  // Employee Detail specific
  employeeDetails: [{
    fullName: String,
    employeeId: String,
    emailAddress: String,
    password: String,
    designation: String,
    department: String,
    contactNo: String,
    dateOfBirth: Date,
    organization: String,
    reportingHead: String,
    reportingDesignation: String
  }],
  
  // Item Master specific
  itemMasterList: [{
    cmdt: String,
    partCode: String,
    partDesc: String,
    supplier: String,
    location: String,
    price: Number,
    uit: String,
    sob: String
  }],
  
  // Quotation Comparison specific
  quotationItems: [{
    rfqNo: String,
    partCode: String,
    partDescription: String,
    specification: String,
    uom: String,
    qty: Number,
    supplier1Price: Number,
    supplier1Amount: Number,
    supplier2Price: Number,
    supplier2Amount: Number,
    supplier3Price: Number,
    supplier3Amount: Number
  }],
  supplierNames: {
    supplier1Name: String,
    supplier2Name: String,
    supplier3Name: String
  },
  quotationTerms: {
    terms1: { gst: String, transport: String, paymentTerms: String, leadTime: String },
    terms2: { gst: String, transport: String, paymentTerms: String, leadTime: String },
    terms3: { gst: String, transport: String, paymentTerms: String, leadTime: String }
  },
  recommendation: { type: String },
  
  // PR Request specific
  prItems: [{
    costCenter: String,
    supplierName: String,
    rfqNo: String,
    partCode: String,
    partDescription: String,
    specification: String,
    cmdt: String,
    uom: String,
    qty: Number,
    unitPrice: Number,
    totalValue: Number
  }],
  
  // PO NPP specific
  poItems: [{
    partCode: String,
    partDescription: String,
    specification: String,
    hsnCode: String,
    instalment: String,
    uom: String,
    pcsCarton: Number,
    qty: Number,
    unitPrice: Number,
    cgst: Number,
    sgst: Number,
    igst: Number
  }],
  poVendorDetails: {
    vendorCode: String,
    vendorName: String,
    vendorAddress: String,
    vendorGst: String,
    vendorContact: String,
    vendorEmail: String
  },
  poOrderDetails: {
    orderNo: String,
    orderDate: Date,
    quotRef: String,
    prNo: String,
    prDate: Date,
    purchaser: String,
    purchaserMobile: String
  },
  poAddressDetails: {
    billingAddress: String,
    billingGst: String,
    shippingAddress: String,
    shippingGst: String
  },
  poTerms: [{ text: String }],
  poFinanceRows: [{ text: String }],
  poDeliverySchedule: [{ text: String }],
  
  // Payment Advise specific
  paymentInvoices: [{
    invoiceNo: String,
    invoiceDate: Date,
    invoiceValue: Number
  }],
  paymentDetails: {
    paymentDueTo: String,
    level: String,
    paymentTo: String,
    expenseType: String,
    expenseAmount: String,
    balanceForPayment: String,
    deduction: String,
    bankDetails: String,
    sapName: String,
    sapCode: String
  },
  
  // WCC NPP specific
  wccDetails: {
    picNameDept: String,
    vendorName: String,
    poWoNo: String,
    workCompletionDate: Date,
    workDescription: String,
    natureOfWork: String,
    briefDetail: String,
    qualityNotes: String
  },
  wccEvaluationRows: [{
    heads: String,
    wtg: Number,
    rating: Number,
    na: Boolean,
    score: Number,
    remark: String
  }],
  
  // Common fields
  stakeholders: [{
    line: { type: String, enum: ['Parallel', 'Sequential'] },
    managerName: String,
    email: String,
    designation: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
    dateTime: Date,
    remarks: String
  }],
  ccList: [{ type: String }],
  attachments: [{
    name: String,
    fileSize: String,
    remark: String,
    fileUrl: String
  }],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Approval fields
  approvedBy: String,
  approvedAt: Date,
  rejectedBy: String,
  rejectedAt: Date,
  approvalComments: String,
  rejectionReason: String
});

module.exports = mongoose.model('NPPRequest', nppRequestSchema);