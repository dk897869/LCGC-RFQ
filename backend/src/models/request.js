const mongoose = require('mongoose');

const stakeholderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  designation: { type: String, required: true },
  line: { type: String, enum: ['Parallel', 'Sequential'], default: 'Sequential' },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'In-Process'],
    default: 'Pending'
  },
  remarks: { type: String, default: '' },
  dateTime: { type: Date, default: null },
  approvedBy: { type: String },
  approvalOrder: { type: Number, required: true },
  notificationSent: { type: Boolean, default: false },
  viewedAt: { type: Date }
});

const attachmentSchema = new mongoose.Schema({
  serialNo: { type: Number },
  name: { type: String },
  fileSize: { type: String },
  remark: { type: String },
  fileUrl: { type: String }
});

const requestSchema = new mongoose.Schema({
  requester: { type: String, required: true },
  department: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  contactNo: { type: String, default: '' },
  organization: { type: String, default: 'Radiant Appliances' },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  vendor: { type: String, required: true },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  description: { type: String, default: '' },
  objective: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'In-Process', 'Completed'],
    default: 'Pending'
  },
  stakeholders: [stakeholderSchema],
  attachments: [attachmentSchema],
  ccList: [{ type: String }],
  requestDate: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  approvalComments: { type: String },
  rejectedBy: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  completionDate: { type: Date },
  currentApproverIndex: { type: Number, default: 0 }
}, { timestamps: true });

// Methods
requestSchema.methods.getCurrentApprover = function() {
  if (!this.stakeholders || this.stakeholders.length === 0) return null;
  const pendingApprovers = this.stakeholders.filter(s => s.status === 'Pending');
  if (pendingApprovers.length > 0) {
    pendingApprovers.sort((a, b) => (a.approvalOrder || 0) - (b.approvalOrder || 0));
    return pendingApprovers[0];
  }
  return null;
};

requestSchema.methods.canUserApprove = function(userEmail) {
  if (!userEmail || !this.stakeholders || this.stakeholders.length === 0) return false;
  const currentApprover = this.getCurrentApprover();
  return currentApprover && currentApprover.email === userEmail;
};

// Prevent model overwrite
const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);

module.exports = Request;