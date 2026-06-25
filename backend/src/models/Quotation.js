const mongoose = require('mongoose');

const quotationAttachmentSchema = new mongoose.Schema({
  name: { type: String },
  url: { type: String },
  fileSize: { type: String },
  uploadedAt: { type: Date, default: Date.now }
});

const quotationSchema = new mongoose.Schema({
  rfqId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RFQ', 
    required: true 
  },
  vendorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true 
  },
  vendorRequestId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'VendorRequest' 
  },
  
  // Quotation details
  price: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  deliveryDays: { type: Number, default: 0 },
  warranty: { type: String, default: '' },
  paymentTerms: { type: String, default: '' },
  remarks: { type: String, default: '' },
  attachments: [quotationAttachmentSchema],
  
  // Additional fields
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  totalAmount: { type: Number },
  
  // Status
  status: { 
    type: String, 
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Winner'], 
    default: 'Draft' 
  },
  
  // Timestamps
  submittedDate: { type: Date },
  approvedDate: { type: Date },
  rejectedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to calculate total
quotationSchema.pre('save', function(next) {
  this.totalAmount = (this.price || 0) + (this.gst || 0) + (this.tax || 0) + (this.shipping || 0) - (this.discount || 0);
  next();
});

// Indexes
quotationSchema.index({ rfqId: 1 });
quotationSchema.index({ vendorId: 1 });
quotationSchema.index({ status: 1 });

module.exports = mongoose.model('Quotation', quotationSchema);