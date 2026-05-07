const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportType: { type: String, enum: ['rfq', 'pr', 'po', 'payment', 'all'], required: true },
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);