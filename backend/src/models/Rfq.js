const mongoose = require('mongoose');

const rfqItemSchema = new mongoose.Schema({
  itemDescription: { type: String, required: true },
  uom: { type: String, default: 'PCS' },
  quantity: { type: Number, required: true, default: 0 },
  make: { type: String, default: '' },
  alternativeSimilar: { type: String, default: '' },
  pictureExistingVendorReference: { type: String, default: '' },
  remark: { type: String, default: '' },
  pictureName: { type: String, default: '' },
  picturePreview: { type: String, default: '' }
});

const approverSchema = new mongoose.Schema({
  line: { type: String, enum: ['Parallel', 'Sequential'], default: 'Parallel' },
  managerName: { type: String, default: '' },
  email: { type: String, default: '' },
  designation: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  dateTime: { type: Date, default: null },
  remarks: { type: String, default: '' }
});

const attachmentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  remark: { type: String, default: '' }
});

const rfqSchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, unique: true, sparse: true },
  requesterName: { type: String, required: true },
  department: { type: String, required: true },
  emailId: { type: String, required: true },
  requestDate: { type: String, required: true },
  contactNo: { type: String, default: '' },
  organization: { type: String, default: 'Radiant Appliances' },
  titleOfActivity: { type: String, required: true },
  purposeAndObjective: { type: String, default: '' },
  vendor: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  priority: { type: String, enum: ['H', 'M', 'L'], default: 'M' },
  items: [rfqItemSchema],
  stakeholders: [approverSchema],
  ccTo: [{ type: String }],
  attachments: [attachmentSchema],
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process'], default: 'Pending' },
  currentApprover: { type: String, default: '' },
  source: { type: String, default: 'RFQ-NPP' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  approvalComments: { type: String },
  rejectedAt: { type: Date },
  rejectedBy: { type: String },
  rejectionComments: { type: String }
});

// Create indexes
rfqSchema.index({ uniqueSerialNo: 1 });
rfqSchema.index({ emailId: 1 });
rfqSchema.index({ status: 1 });
rfqSchema.index({ createdAt: -1 });

// Virtual for formatted priority
rfqSchema.virtual('priorityFormatted').get(function() {
  const map = { 'H': 'High', 'M': 'Medium', 'L': 'Low' };
  return map[this.priority] || 'Medium';
});

// Virtual for formatted status
rfqSchema.virtual('statusFormatted').get(function() {
  const map = { 
    'Pending': 'Pending', 
    'Approved': 'Approved', 
    'Rejected': 'Rejected', 
    'In-Process': 'In Process' 
  };
  return map[this.status] || this.status;
});

// Enable virtuals in JSON
rfqSchema.set('toJSON', { virtuals: true });
rfqSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RFQ', rfqSchema);