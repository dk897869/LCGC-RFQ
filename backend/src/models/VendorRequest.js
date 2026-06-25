const mongoose = require('mongoose');

const vendorRequestVendorSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorName: { type: String, required: true },
  email: { type: String, required: true },
  company: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Quoted'], 
    default: 'Pending' 
  },
  remarks: { type: String, default: '' },
  quotationSubmitted: { type: Boolean, default: false },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  submittedDate: { type: Date },
  viewedDate: { type: Date },
  emailSentDate: { type: Date }
});

const vendorRequestSchema = new mongoose.Schema({
  rfqId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RFQ', 
    required: true 
  },
  rfqNumber: { type: String, required: true },
  vendors: [vendorRequestVendorSchema],
  status: { 
    type: String, 
    enum: ['Draft', 'Waiting', 'Sent', 'Received', 'Completed'], 
    default: 'Waiting' 
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdDate: { type: Date, default: Date.now },
  sentDate: { type: Date },
  completedDate: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
vendorRequestSchema.index({ rfqId: 1 });
vendorRequestSchema.index({ status: 1 });
vendorRequestSchema.index({ createdDate: -1 });

module.exports = mongoose.model('VendorRequest', vendorRequestSchema);