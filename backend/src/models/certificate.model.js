// models/certificate.model.js
const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: {
    type: String,
    required: true,
    unique: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'requestModel',
    required: true
  },
  requestModel: {
    type: String,
    enum: ['NPPRequest', 'EPRequest'],
    default: 'NPPRequest'
  },
  requestType: {
    type: String,
    enum: ['wcc', 'ep', 'rfq', 'pr', 'po', 'payment'],
    default: 'wcc'
  },
  serialNo: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
certificateSchema.index({ requestId: 1 });
certificateSchema.index({ serialNo: 1 });
certificateSchema.index({ certificateId: 1 });
certificateSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('Certificate', certificateSchema);