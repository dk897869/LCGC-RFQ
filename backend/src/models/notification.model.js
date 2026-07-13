const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  type: { type: String, default: 'system' },
  status: { type: String, default: 'pending' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
