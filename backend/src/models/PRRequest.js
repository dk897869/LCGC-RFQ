const mongoose = require('mongoose');

const prItemSchema = new mongoose.Schema({
  costCenter: { type: String, default: '' },
  supplierName: { type: String, default: '' },
  partCode: { type: String, default: '' },
  partDescription: { type: String, default: '' },
  specification: { type: String, default: '' },
  uom: { type: String, default: 'PCS' },
  qty: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 }
});

const prApproverSchema = new mongoose.Schema({
  line: { type: String, enum: ['Parallel', 'Sequential'], default: 'Parallel' },
  managerName: { type: String, default: '' },
  email: { type: String, default: '' },
  designation: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  dateTime: { type: String, default: '' },
  remarks: { type: String, default: '' }
});

const prAttachmentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  remark: { type: String, default: '' }
});

const prRequestSchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, unique: true, required: true },
  requesterName: { type: String, required: true },
  department: { type: String, required: true },
  emailId: { type: String, required: true },
  requestDate: { type: String, required: true },
  contactNo: { type: String, default: '' },
  organization: { type: String, default: 'Radiant Appliances' },
  titleOfActivity: { type: String, required: true },
  purposeAndObjective: { type: String, default: '' },
  priority: { type: String, enum: ['H', 'M', 'L'], default: 'M' },
  items: [prItemSchema],
  stakeholders: [prApproverSchema],
  ccList: [{ type: String }],
  attachments: [prAttachmentSchema],
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In Process'], default: 'Pending' },
  source: { type: String, default: 'PR-REQUEST-NPP' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PRRequest', prRequestSchema);