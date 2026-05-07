const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  partCode: { type: String, default: '' },
  partDescription: { type: String, default: '' },
  specification: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  instalment: { type: String, default: '' },
  uom: { type: String, default: 'PCS' },
  pcsCarton: { type: Number, default: 0 },
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

const poTermSchema = new mongoose.Schema({
  text: { type: String, default: '' }
});

const poFinanceRowSchema = new mongoose.Schema({
  text: { type: String, default: '' }
});

const poDeliveryScheduleSchema = new mongoose.Schema({
  text: { type: String, default: '' }
});

const poRequestSchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, unique: true, required: true },
  rfqSerialNo: { type: String, default: '' },
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
  titleOfActivity: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  items: [poItemSchema],
  stakeholders: [poApproverSchema],
  ccList: [{ type: String }],
  terms: [poTermSchema],
  financeRows: [poFinanceRowSchema],
  deliverySchedule: [poDeliveryScheduleSchema],
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In Process'], default: 'Pending' },
  source: { type: String, default: 'PO-NPP' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PORequest', poRequestSchema);