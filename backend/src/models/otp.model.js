const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { 
    type: String, 
    lowercase: true,
    trim: true,
    index: true
  },
  mobile: { 
    type: String,
    trim: true,
    index: true
  },
  otp: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['login', 'registration', 'reset', 'verification', 'email_verification'],
    default: 'login'
  },
  referenceSid: { 
    type: String 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000)
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: 600 // Auto delete after 10 minutes
  }
});

// Index for faster queries
otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ mobile: 1, type: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);

module.exports = OTP;