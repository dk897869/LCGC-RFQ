const mongoose = require('mongoose');

const orderHistorySchema = new mongoose.Schema({
  uniqueSerialNo: { type: String, required: true, index: true },
  type: { type: String, enum: ['rfq', 'pr', 'po', 'payment'], required: true },
  title: { type: String, required: true },
  submittedDate: { type: String, required: true },
  status: { type: String, default: 'Pending' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

orderHistorySchema.index({ uniqueSerialNo: 1, createdBy: 1 });

module.exports = mongoose.model('OrderHistory', orderHistorySchema);