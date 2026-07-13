const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  partCode: { type: String, default: '' },
  partDescription: { type: String, default: '' },
  specification: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  uom: { type: String, default: 'PCS' },
  qty: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 }
});

const poApproverSchema = new mongoose.Schema({
  line: { type: String, enum: ['Parallel', 'Sequential'], default: 'Parallel' },
  managerName: { type: String, default: '' },
  email: { type: String, default: '' },
  designation: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  dateTime: { type: String, default: '' },
  remarks: { type: String, default: '' }
});

const poNppSchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, unique: true, required: true },
  requesterName: { type: String, default: '' },
  department: { type: String, default: '' },
  emailId: { type: String, default: '' },
  requestDate: { type: String, default: '' },
  contactNo: { type: String, default: '' },
  organization: { type: String, default: 'Radiant Appliances' },
  titleOfActivity: { type: String, default: '' },
  purposeAndObjective: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
  priority: { type: String, default: 'M' },
  
  vendorCode: { type: String, default: '' },
  vendorName: { type: String, default: '' },
  vendorAddress: { type: String, default: '' },
  vendorGst: { type: String, default: '' },
  vendorContact: { type: String, default: '' },
  vendorEmail: { type: String, default: '' },
  vendorKindAttn: { type: String, default: '' },
  
  orderNo: { type: String, default: '' },
  orderDate: { type: String, default: '' },
  quotRef: { type: String, default: '' },
  prNo: { type: String, default: '' },
  prDate: { type: String, default: '' },
  purchaser: { type: String, default: '' },
  purchaserMobile: { type: String, default: '' },
  
  billingAddress: { type: String, default: '' },
  billingGst: { type: String, default: '' },
  shippingAddress: { type: String, default: '' },
  shippingGst: { type: String, default: '' },
  
  transporter: { type: String, default: '' },
  taxes: { type: String, default: '' },
  
  items: [poItemSchema],
  stakeholders: [poApproverSchema],
  ccList: [{ type: String }],
  terms: { type: mongoose.Schema.Types.Mixed, default: [] },
  financeRows: { type: mongoose.Schema.Types.Mixed, default: [] },
  deliverySchedule: { type: mongoose.Schema.Types.Mixed, default: [] },
  
  status: { type: String, default: 'Pending' },
  source: { type: String, default: 'PO-NPP' }
}, { timestamps: true });

module.exports = mongoose.model('PoNpp', poNppSchema);