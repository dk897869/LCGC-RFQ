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
  
  // RFQ Workflow fields
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'In-Process', 'Vendor Finalized'], default: 'Pending' },
  currentStage: { type: String, enum: ['RFQ', 'Vendor Request', 'Vendor Request Sent', 'Quotation Status', 'Completed', 'Rejected'], default: 'RFQ' },
  vendorRequestCreated: { type: Boolean, default: false },
  quotationCompleted: { type: Boolean, default: false },
  
  // Approval fields
  approvalDate: { type: Date },
  approvedBy: { type: String },
  approvalComments: { type: String },
  rejectedBy: { type: String },
  rejectedReason: { type: String },
  rejectedDate: { type: Date },
  rejectionComments: { type: String },
  
  // Winner fields
  winnerVendorId: { type: String },
  winnerVendorName: { type: String },
  winnerPrice: { type: Number },
  
  // Audit fields
  currentApprover: { type: String, default: '' },
  source: { type: String, default: 'RFQ-NPP' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes
rfqSchema.index({ uniqueSerialNo: 1 });
rfqSchema.index({ emailId: 1 });
rfqSchema.index({ status: 1 });
rfqSchema.index({ createdAt: -1 });
rfqSchema.index({ currentStage: 1 });
rfqSchema.index({ vendorRequestCreated: 1 });

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
    'In-Process': 'In Process',
    'Vendor Finalized': 'Vendor Finalized'
  };
  return map[this.status] || this.status;
});

// Enable virtuals in JSON
rfqSchema.set('toJSON', { virtuals: true });
rfqSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RFQ', rfqSchema);