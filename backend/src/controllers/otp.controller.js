const User = require('../models/user');
const OTP = require('../models/otp.model');
const { sendSmsOtp, verifySmsOtp, sendEmailOtp } = require('../services/twilio.service');

// Generate random 6-digit OTP for email
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Save OTP to database (for email OTP only)
const saveOTP = async (email, mobile, otp, type) => {
  await OTP.deleteMany({
    $or: [{ email: email }, { mobile: mobile }],
    type: type
  });

  await OTP.create({
    email: email,
    mobile: mobile,
    otp: otp,
    type: type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
  });
};

// Send OTP via Email
exports.sendEmailOTP = async (req, res) => {
  try {
    const { email, type = 'login' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists (for login/reset)
    if (type === 'login' || type === 'reset') {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Email not registered' });
      }
    }

    const otp = generateOTP();
    console.log(`📧 Email OTP for ${email}: ${otp}`);

    await saveOTP(email, null, otp, type);

    const result = await sendEmailOtp(email, email.split('@')[0], otp, type);

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: `OTP sent to ${email}`,
      method: 'email'
    });
  } catch (error) {
    console.error('Send Email OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send OTP via SMS using Twilio Verify
exports.sendSmsOTP = async (req, res) => {
  try {
    const { mobile, type = 'login' } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    // Check if user exists (for login/reset)
    if (type === 'login' || type === 'reset') {
      const cleanMobile = mobile.replace(/\D/g, '');
      const user = await User.findOne({ contactNo: { $regex: cleanMobile + '$', $options: 'i' } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Mobile number not registered' });
      }
    }

    // Use Twilio Verify API to send SMS
    const result = await sendSmsOtp(mobile);

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    // Store reference in database
    await OTP.deleteMany({ mobile: mobile, type: type });
    await OTP.create({
      mobile: mobile,
      otp: 'twilio_verify', // Twilio manages the actual OTP
      type: type,
      referenceSid: result.sid,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    res.json({
      success: true,
      message: `OTP sent to ${mobile}`,
      method: 'mobile',
      status: result.status
    });
  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP (supports both email and SMS)
exports.verifyOTP = async (req, res) => {
  try {
    const { email, mobile, otp, method = 'email', type = 'login' } = req.body;

    if ((!email && !mobile) || !otp) {
      return res.status(400).json({ success: false, message: 'Email/Mobile and OTP are required' });
    }

    let isValid = false;
    let user = null;

    if (method === 'email') {
      // Verify email OTP from database
      const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        otp: otp,
        type: type
      });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }

      if (new Date() > otpRecord.expiresAt) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({ success: false, message: 'OTP has expired' });
      }

      isValid = true;
      user = await User.findOne({ email: email.toLowerCase() });
      await OTP.deleteOne({ _id: otpRecord._id });
    } 
    else if (method === 'mobile') {
      // Verify SMS OTP using Twilio Verify API
      const result = await verifySmsOtp(mobile, otp);
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error });
      }
      
      if (!result.isValid) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }
      
      isValid = true;
      const cleanMobile = mobile.replace(/\D/g, '');
      user = await User.findOne({ contactNo: { $regex: cleanMobile + '$', $options: 'i' } });
      await OTP.deleteMany({ mobile: mobile, type: type });
    }

    res.json({
      success: true,
      isValid: isValid,
      message: isValid ? 'OTP verified successfully' : 'Invalid OTP',
      user: user ? { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        role: user.role 
      } : null
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email, mobile, method = 'email', type = 'login' } = req.body;

    if (method === 'email' && !email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (method === 'mobile' && !mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    // Delete existing OTPs
    if (method === 'email') {
      await OTP.deleteMany({ email: email.toLowerCase(), type: type });
    } else {
      await OTP.deleteMany({ mobile: mobile, type: type });
    }

    // Resend OTP
    if (method === 'email') {
      return exports.sendEmailOTP(req, res);
    } else {
      return exports.sendSmsOTP(req, res);
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};