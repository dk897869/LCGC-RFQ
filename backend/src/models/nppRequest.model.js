const mongoose = require('mongoose');

const nppRequestSchema = new mongoose.Schema({
  type: { type: String, required: true },
  uniqueSerialNo: { type: String, unique: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  requesterName: { type: String },
  department: { type: String },
  emailId: { type: String },
  requestDate: { type: Date, default: Date.now },
  contactNo: { type: String },
  organization: { type: String },
  titleOfActivity: { type: String },
  priority: { type: String },
  purposeAndObjective: { type: String },
  stakeholders: [{
    line: String,
    managerName: String,
    email: String,
    designation: String,
    status: { type: String, default: 'Pending' },
    remarks: String
  }],
  ccList: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  approvedBy: String,
  approvedAt: Date,
  approvalComments: String,
  rejectedBy: String,
  rejectedAt: Date,
  rejectionReason: String,
  
  // Cash Purchase
  cashPurchaseItems: [{
    itemDescription: String,
    purpose: String,
    paymentDetail: String,
    billInvoiceCopy: String
  }],
  
  // New Vendor
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
  
  // RFQ Vendor
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
  
  // RFQ Requisition
  rfqItems: [{
    description: String,
    uom: String,
    quantity: Number,
    make: String,
    alternative: String,
    vendorRef: String,
    remark: String
  }],
  
  // Vendor List
  vendorList: [{
    vendorCode: String,
    vendorName: String,
    emailId: String,
    phoneNo: String,
    status: String
  }],
  
  // Employee Detail
  employeeDetails: [{
    fullName: String,
    employeeId: String,
    emailAddress: String,
    designation: String,
    department: String,
    contactNo: String
  }],
  
  // Item Master
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
  
  // Quotation Comparison
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
  
  // PR Request
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
  
  // PO NPP
  poItems: [{
    partCode: String,
    partDescription: String,
    specification: String,
    hsnCode: String,
    uom: String,
    qty: Number,
    unitPrice: Number,
    cgst: Number,
    sgst: Number,
    igst: Number
  }],
  
  // Payment Advise
  paymentInvoices: [{
    invoiceNo: String,
    invoiceDate: Date,
    invoiceValue: Number
  }],
  paymentDetails: {
    paymentDueTo: String,
    paymentTo: String,
    expenseType: String,
    expenseAmount: String,
    bankDetails: String
  },
  
  // WCC NPP
  wccDetails: {
    vendorName: String,
    poWoNo: String,
    workCompletionDate: Date,
    workDescription: String,
    natureOfWork: String,
    qualityNotes: String
  },
  wccEvaluationRows: [{
    heads: String,
    wtg: Number,
    rating: Number,
    na: Boolean,
    score: Number,
    remark: String
  }]
});

module.exports = mongoose.model('NPPRequest', nppRequestSchema);