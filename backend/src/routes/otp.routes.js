const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otp.controller');

// Send OTP
router.post('/send-email', otpController.sendEmailOTP);
router.post('/send-sms', otpController.sendSmsOTP);

// Verify OTP
router.post('/verify', otpController.verifyOTP);

// Resend OTP
router.post('/resend', otpController.resendOTP);

module.exports = router;