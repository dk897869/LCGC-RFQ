const mongoose = require('mongoose');

const prNppSchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, required: true, unique: true },
  requesterName: { type: String, required: true },
  department: { type: String },
  emailId: { type: String, lowercase: true },
  requestDate: { type: String },
  contactNo: { type: String },
  organization: { type: String, default: 'Radiant Appliances' },
  departmentBudget: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  costCenter: { type: String },
  altCostCenter: { type: String },
  titleOfActivity: { type: String },
  approvalFor: { type: String },
  rfqNo: { type: String },
  status: { type: String, default: 'Pending' },
  items: { type: Array, default: [] },
  comparisonItems: { type: Array, default: [] },
  suppliers: { type: Array, default: [] },
  termsRows: { type: Array, default: [] },
  attachment1: { type: String },
  attachment2: { type: String },
  attachment3: { type: String },
  bestSupplier: { type: String },
  selectedSupplier: { type: String },
  recommendation: { type: String },
  approvalChain: { type: Array, default: [] },
  attachments: { type: Array, default: [] },
  ccList: { type: Array, default: [] },
  submittedDate: { type: String },
  comparisonId: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.PrNpp || mongoose.model('PrNpp', prNppSchema);