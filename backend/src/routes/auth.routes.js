const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/auth.controller');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendMail } = require('../services/mail.service');

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ==================== HELPER FUNCTIONS ====================
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, rights: user.rights || {} },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );
};

// ==================== GOOGLE LOGIN ROUTE ====================
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    console.log('📥 Google login request received');
    
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    
    // Decode Google JWT token (client-side verification)
    const decoded = jwt.decode(credential);
    
    console.log('📝 Decoded Google token:', decoded ? { email: decoded.email, name: decoded.name } : 'null');
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google credential' });
    }
    
    const { email, name, picture, sub: googleId } = decoded;
    const User = require('../models/user.model');
    
    let user = await User.findOne({ $or: [{ googleId: googleId }, { email: email.toLowerCase() }] });
    
    if (!user) {
      console.log('👤 Creating new user from Google login');
      // Create new user
      const randomPassword = crypto.randomBytes(20).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        googleId: googleId,
        password: hashedPassword,
        emailVerified: true,
        role: 'User',
        profileImage: picture || '',
        rights: {},
        isActive: true
      });
      
      await user.save();
      console.log('✅ New user created:', user.email);
      
      // Send welcome email
      await sendMail({
        to: user.email,
        subject: 'Welcome to LCGC System!',
        type: 'welcome',
        data: { name: user.name }
      }).catch(err => console.log('Welcome email error:', err.message));
    } else if (!user.googleId) {
      console.log('🔗 Linking Google account to existing user');
      // Link Google account to existing user
      user.googleId = googleId;
      if (picture && !user.profileImage) user.profileImage = picture;
      await user.save();
    } else {
      console.log('✅ Existing user found:', user.email);
    }
    
    const token = generateToken(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    
    console.log('🎉 Google login successful for:', user.email);
    
    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        emailVerified: user.emailVerified,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error('❌ Google login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== GOOGLE LOGIN WITH ID TOKEN ====================
router.post('/google-idtoken', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    console.log('📥 Google ID token login request received');
    
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }
    
    // Verify token with Google
    const fetch = require('node-fetch');
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const payload = await response.json();
    
    if (!payload.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    
    const { email, name, picture, sub: googleId } = payload;
    const User = require('../models/user.model');
    
    let user = await User.findOne({ $or: [{ googleId: googleId }, { email: email.toLowerCase() }] });
    
    if (!user) {
      const randomPassword = crypto.randomBytes(20).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        googleId: googleId,
        password: hashedPassword,
        emailVerified: true,
        role: 'User',
        profileImage: picture || '',
        rights: {}
      });
      
      await user.save();
      
      await sendMail({
        to: user.email,
        subject: 'Welcome to LCGC System!',
        type: 'welcome',
        data: { name: user.name }
      }).catch(err => console.log('Welcome email error:', err.message));
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (picture && !user.profileImage) user.profileImage = picture;
      await user.save();
    }
    
    const token = generateToken(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    
    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        emailVerified: user.emailVerified,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error('Google ID token login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== FACEBOOK LOGIN ====================
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken, userID } = req.body;
    
    if (!accessToken || !userID) {
      return res.status(400).json({ success: false, message: 'Facebook access token and user ID are required' });
    }
    
    const fetch = require('node-fetch');
    const fbResponse = await fetch(`https://graph.facebook.com/v18.0/${userID}?fields=id,name,email,picture&access_token=${accessToken}`);
    const fbData = await fbResponse.json();
    
    if (!fbData.email) {
      return res.status(400).json({ success: false, message: 'Facebook email not available' });
    }
    
    const { email, name, picture, id: facebookId } = fbData;
    const User = require('../models/user.model');
    
    let user = await User.findOne({ $or: [{ facebookId: facebookId }, { email: email.toLowerCase() }] });
    
    if (!user) {
      const randomPassword = crypto.randomBytes(20).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        facebookId: facebookId,
        password: hashedPassword,
        emailVerified: true,
        role: 'User',
        profileImage: picture?.data?.url || '',
        rights: {}
      });
      
      await user.save();
      
      await sendMail({
        to: user.email,
        subject: 'Welcome to LCGC System!',
        type: 'welcome',
        data: { name: user.name }
      }).catch(err => console.log('Welcome email error:', err.message));
    } else if (!user.facebookId) {
      user.facebookId = facebookId;
      if (picture?.data?.url && !user.profileImage) user.profileImage = picture.data.url;
      await user.save();
    }
    
    const token = generateToken(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    
    res.json({
      success: true,
      message: 'Facebook login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        emailVerified: user.emailVerified,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error('Facebook login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TWITTER LOGIN ROUTES ====================
router.get('/twitter/request-token', async (req, res) => {
  try {
    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');
    
    const oauth = OAuth({
      consumer: {
        key: process.env.TWITTER_API_KEY || 'dummy_key',
        secret: process.env.TWITTER_API_SECRET || 'dummy_secret'
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      }
    });
    
    const requestData = {
      url: 'https://api.twitter.com/oauth/request_token',
      method: 'POST',
      data: { oauth_callback: process.env.TWITTER_CALLBACK_URL || 'http://localhost:4200/auth/twitter/callback' }
    };
    
    const fetch = require('node-fetch');
    const response = await fetch(requestData.url, {
      method: requestData.method,
      headers: oauth.toHeader(oauth.authorize(requestData))
    });
    
    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');
    
    if (!oauthToken) {
      return res.status(400).json({ success: false, message: 'Failed to get Twitter request token' });
    }
    
    const authUrl = `https://api.twitter.com/oauth/authenticate?oauth_token=${oauthToken}`;
    
    res.json({
      success: true,
      oauthToken,
      oauthTokenSecret,
      authUrl
    });
  } catch (error) {
    console.error('Twitter request token error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/twitter', async (req, res) => {
  try {
    const { oauthToken, oauthVerifier } = req.body;
    
    if (!oauthToken || !oauthVerifier) {
      return res.status(400).json({ success: false, message: 'Twitter OAuth token and verifier are required' });
    }
    
    // For now, return a message that Twitter login needs configuration
    res.json({
      success: false,
      message: 'Twitter login not fully configured. Please set up Twitter API credentials.'
    });
  } catch (error) {
    console.error('Twitter login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== NPP PROCUREMENT ROUTES ====================
// Create NPP requests by type
router.post('/npp/cash-purchase', authMiddleware, authController.createNppRequest);
router.post('/npp/new-vendor', authMiddleware, authController.createNppRequest);
router.post('/npp/rfq-vendor', authMiddleware, authController.createNppRequest);
router.post('/npp/rfq-requisition', authMiddleware, authController.createNppRequest);
router.post('/npp/vendor-list', authMiddleware, authController.createNppRequest);
router.post('/npp/employee-detail', authMiddleware, authController.createNppRequest);
router.post('/npp/item-master', authMiddleware, authController.createNppRequest);
router.post('/npp/quotation-comparison', authMiddleware, authController.createNppRequest);
router.post('/npp/pr-request', authMiddleware, authController.createNppRequest);
router.post('/npp/po-npp', authMiddleware, authController.createNppRequest);
router.post('/npp/payment-advise', authMiddleware, authController.createNppRequest);
router.post('/npp/wcc-npp', authMiddleware, authController.createNppRequest);

// Get all NPP requests with filters
router.get('/npp/requests', authMiddleware, authController.getAllNppRequests);
router.get('/npp/stats', authMiddleware, authController.getNppStats);
router.get('/npp/request/:id', authMiddleware, authController.getNppRequestById);
router.get('/npp/serial/:serialNo', authMiddleware, authController.getNppRequestBySerialNo);

// Update and delete
router.put('/npp/request/:id', authMiddleware, authController.updateNppRequest);
router.delete('/npp/request/:id', authMiddleware, authController.deleteNppRequest);

// Approve/Reject
router.patch('/npp/request/:id/approve', authMiddleware, authController.approveNppRequest);
router.patch('/npp/request/:id/reject', authMiddleware, authController.rejectNppRequest);
router.post('/npp/request/:id/send-email', authMiddleware, authController.sendNppRequestEmail);

// ==================== PUBLIC ROUTES ====================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendEmailOTP);
router.post('/verify-otp', authController.verifyOTP);

// ==================== DIRECT MOBILE OTP ROUTES (Fast2SMS) ====================

// Send Mobile OTP using Fast2SMS
app.post('/api/auth/send-mobile-otp', async (req, res) => {
  console.log('📍 DIRECT /send-mobile-otp route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { mobile, type = 'registration' } = req.body;
    
    if (!mobile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number is required' 
      });
    }
    
    // Clean mobile number - remove any non-digit characters
    let cleanMobile = mobile.replace(/\D/g, '');
    
    // Remove leading zero if present
    if (cleanMobile.startsWith('0')) {
      cleanMobile = cleanMobile.substring(1);
    }
    
    // Ensure it's a 10-digit number (remove country code if present)
    if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) {
      cleanMobile = cleanMobile.substring(2);
    }
    
    // Validate 10-digit Indian mobile number
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit mobile number' 
      });
    }
    
    console.log(`📱 Sending OTP to: ${cleanMobile}`);
    
    const User = require('./models/user.model');
    const OTP = require('./models/otp.model');
    
    // For registration, check if mobile already exists
    if (type === 'registration') {
      const existingUser = await User.findOne({ 
        contactNo: { $regex: cleanMobile + '$', $options: 'i' } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mobile number already registered' 
        });
      }
    }
    
    // For login, check if mobile exists
    if (type === 'login') {
      const existingUser = await User.findOne({ 
        contactNo: { $regex: cleanMobile + '$', $options: 'i' } 
      });
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'Mobile number not registered' 
        });
      }
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 OTP for ${cleanMobile}: ${otp}`);
    
    // Save OTP to database
    await OTP.deleteMany({ mobile: cleanMobile, type: type });
    await OTP.create({
      mobile: cleanMobile,
      otp: otp,
      type: type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    
    // Send SMS via Fast2SMS
    const axios = require('axios');
    const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
    const FAST2SMS_SENDER_ID = process.env.FAST2SMS_SENDER_ID || 'TXTIND';
    const FAST2SMS_ROUTE = process.env.FAST2SMS_ROUTE || 'v3';
    
    let smsSent = false;
    let smsError = null;
    
    try {
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: FAST2SMS_ROUTE,
        sender_id: FAST2SMS_SENDER_ID,
        message: `Your verification code is: ${otp}. This code will expire in 10 minutes. - LCGC RFQ`,
        language: 'english',
        flash: 0,
        numbers: cleanMobile
      }, {
        headers: {
          'authorization': FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data && response.data.return) {
        if (response.data.return === true || response.data.status === 'success') {
          smsSent = true;
          console.log('✅ Fast2SMS OTP sent successfully:', response.data);
        } else {
          smsError = response.data.message || 'Failed to send SMS';
          console.error('❌ Fast2SMS error:', response.data);
        }
      } else {
        smsError = 'Invalid response from SMS provider';
      }
      
    } catch (smsErr) {
      console.error('❌ Fast2SMS request failed:', smsErr.message);
      smsError = smsErr.message;
      
      if (smsErr.response) {
        console.error('Fast2SMS response:', smsErr.response.data);
      }
    }
    
    // Return response
    if (smsSent) {
      res.json({
        success: true,
        message: `OTP sent successfully to ${mobile}`,
        method: 'mobile',
        provider: 'fast2sms'
      });
    } else {
      // Fallback - return OTP for development/testing
      res.json({
        success: true,
        message: `OTP generated. In production, SMS would be sent.`,
        method: 'mobile',
        devOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
        smsError: smsError,
        note: 'Check server logs for OTP in development mode'
      });
    }
    
  } catch (error) {
    console.error('Send Mobile OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify Mobile OTP
app.post('/api/auth/verify-mobile-otp', async (req, res) => {
  console.log('📍 DIRECT /verify-mobile-otp route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { mobile, otp, type = 'registration' } = req.body;
    
    if (!mobile || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number and OTP are required' 
      });
    }
    
    let cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.startsWith('0')) cleanMobile = cleanMobile.substring(1);
    if (cleanMobile.length === 12 && cleanMobile.startsWith('91')) cleanMobile = cleanMobile.substring(2);
    
    const OTP = require('./models/otp.model');
    
    const otpRecord = await OTP.findOne({
      mobile: cleanMobile,
      otp: otp,
      type: type
    });
    
    if (!otpRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }
    
    await OTP.deleteOne({ _id: otpRecord._id });
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
    
  } catch (error) {
    console.error('Verify Mobile OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// Email verification routes
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Social login callback
router.post('/social-callback', authController.socialLoginCallback);

// ==================== PROTECTED ROUTES (Require Auth) ====================
router.use(authMiddleware);

// User profile routes
router.get('/me', authController.getMe);
router.get('/profile', authController.getMe);
router.patch('/profile', authController.updateProfile);
router.put('/profile', authController.updateProfile);
router.post('/update-profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);
router.patch('/change-password', authController.changePassword);
router.post('/refresh-session', authController.refreshUserSession);
router.get('/departments', authController.getDepartments);
router.get('/managers', authController.getManagers);

// Profile photo routes
router.post('/upload-avatar', upload.single('avatar'), authController.uploadProfilePhoto);
router.post('/upload-profile-photo', upload.single('profileImage'), authController.uploadProfilePhoto);

// Clear avatar route
router.delete('/avatar', authController.clearAvatar);
router.delete('/profile-photo', authController.clearAvatar);
// ==================== FORGOT / RESET PASSWORD ROUTES ====================

// Password reset with link (email)
router.post('/forgot-password-link', authController.sendForgotPasswordLink);
router.post('/reset-password-with-token', authController.resetPasswordWithToken);
router.get('/check-reset-token', authController.checkResetToken);

// Password reset with OTP (alternative)
router.post('/forgot-password-otp', authController.sendForgotPasswordOTP);
router.post('/verify-otp-reset-password', authController.verifyOTPAndResetPassword);

// Legacy routes (keep for compatibility)
router.post('/forgot-password', authController.sendForgotPasswordOTP);
router.post('/reset-password', authController.verifyOTPAndResetPassword);
router.post('/send-reset-link', authController.sendForgotPasswordLink);
// EP Request routes
router.post('/ep-requests', authController.createEPRequest);
router.get('/ep-requests', authController.getAllEPRequests);
router.get('/ep-requests/:id', authController.getEPRequestById);
router.put('/ep-requests/:id', authController.updateEPRequest);
router.delete('/ep-requests/:id', authController.deleteEPRequest);
router.patch('/ep-requests/:id/approve', authController.approveEPRequest);
router.patch('/ep-requests/:id/reject', authController.rejectEPRequest);
router.get('/ep-requests-stats', authController.getEPRequestStats);
router.post('/ep-requests-send-email', authController.sendEPRequestEmail);

// ==================== EXPORT ROUTER ====================
module.exports = router;