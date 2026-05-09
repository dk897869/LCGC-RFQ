require("dotenv").config();  // ✅ MUST BE FIRST!

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
// const morgan = require("morgan"); // Commented out - install if needed
const multer = require("multer");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const axios = require("axios"); // Add for Fast2SMS

const connectDB = require("./config/db");

// ==================== DEFINE AUTH MIDDLEWARE FIRST ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Helper function to safely require routes
const safeRequire = (routePath, defaultValue) => {
  try {
    const module = require(routePath);
    if (typeof module === 'function') {
      return module;
    }
    return module;
  } catch (err) {
    console.warn(`⚠️ Could not load ${routePath}: ${err.message}`);
    return defaultValue || ((req, res) => res.status(501).json({ 
      success: false, 
      message: `${routePath} API not available yet`
    }));
  }
};

// ROUTES
const authRoutes = safeRequire("./routes/auth.routes");
const dashboardRoutes = safeRequire("./routes/dashboard.routes");
const requestRoutes = safeRequire("./routes/request.routes");
const vendorRoutes = safeRequire("./routes/vendor.routes");
const partRoutes = safeRequire("./routes/part.routes");
const userRoutes = safeRequire("./routes/user.routes");
const paymentNppRoutes = safeRequire("./routes/paymentNpp.routes");
const poNppRoutes = safeRequire("./routes/poNpp.routes");
const prNppRoutes = safeRequire("./routes/prNpp.routes");
const rfqRoutes = safeRequire("./routes/rfq.routes");
const orderHistoryRoutes = safeRequire("./routes/orderHistory.routes");
const reportRoutes = safeRequire("./routes/report.routes");
const approvalRoutes = safeRequire("./routes/approval.routes");
const serialNumberRoutes = safeRequire("./routes/serialNumber.routes");

const app = express();

// ==================== MULTER CONFIGURATION FOR AVATAR ====================
// Ensure upload directories exist
const avatarUploadDir = path.join(__dirname, "uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

// Avatar storage configuration
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

// Configure multer to accept multiple field names
const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept common field names
    const allowedFields = ['avatar', 'profileImage', 'photo', 'image', 'file'];
    if (allowedFields.includes(file.fieldname) && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Only images are allowed. Received field: ${file.fieldname}`), false);
    }
  }
});

// Database connection
connectDB();

// ==================== CORS CONFIGURATION - COMPLETE FIX ====================
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:10000',
  'https://lcgc-rfq.onrender.com',
  'https://lcgc-rfq-frontend.onrender.com',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL
].filter(Boolean);

// Main CORS middleware - MUST be before any routes
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Allow any render.com subdomain
    if (origin && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log(`🌐 CORS request from: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'X-Requested-With', 
    'Origin',
    'Cookie',
    'Cache-Control',
    'multipart/form-data'
  ],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Handle preflight requests - SAFE VERSION
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  next();
});

// Additional CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false
}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Custom logging middleware (replaces morgan)
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// Helper function
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      rights: user.rights || {} 
    },
    process.env.JWT_SECRET || 'fallback_secret_change_me',
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );
};

// ==================== FAST2SMS SERVICE ====================
const FAST2SMS_API_KEY = 'xWX9L0fUhYl1cg5vw7NFnRjs3kAp2GqybiHTrzSmBIDJt4Kud8yDa6epRdYAtxPjvIriZohgm1cOfE35';

const sendSmsViaFast2SMS = async (mobileNumber, otp) => {
  try {
    let cleanNumber = mobileNumber.replace(/\D/g, '');
    if (cleanNumber.startsWith('91')) cleanNumber = cleanNumber.substring(2);
    if (cleanNumber.startsWith('0')) cleanNumber = cleanNumber.substring(1);
    
    if (cleanNumber.length !== 10) {
      return { success: false, error: 'Invalid mobile number' };
    }
    
    const response = await axios({
      method: 'GET',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      params: {
        authorization: FAST2SMS_API_KEY,
        route: 'q',
        message: `${otp} is your OTP for LCGC RFQ. Valid for 10 minutes.`,
        numbers: cleanNumber,
        flash: 0
      },
      timeout: 10000
    });
    
    if (response.data && response.data.return === true) {
      return { success: true };
    } else {
      return { success: false, error: response.data?.message || 'SMS failed' };
    }
  } catch (error) {
    console.error('Fast2SMS Error:', error.message);
    return { success: false, error: error.message };
  }
};

// ==================== AVATAR UPLOAD ROUTE ====================
app.post('/api/auth/upload-avatar', (req, res) => {
  console.log('📍 /api/auth/upload-avatar route hit');
  
  // First check if token exists
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided. Please login first.' 
    });
  }
  
  // Process upload
  uploadAvatar.any()(req, res, async (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }
    
    try {
      // Get uploaded file
      const uploadedFile = req.files && req.files[0];
      
      if (!uploadedFile) {
        return res.status(400).json({ 
          success: false, 
          message: 'No image file uploaded. Please select an image file.' 
        });
      }
      
      console.log('✅ File received:', {
        fieldname: uploadedFile.fieldname,
        originalname: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size
      });
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const User = require('./models/user.model');
      
      const avatarUrl = `/uploads/avatars/${uploadedFile.filename}`;
      
      const updatedUser = await User.findByIdAndUpdate(
        decoded.id,
        { 
          $set: { 
            avatar: avatarUrl, 
            profileImage: avatarUrl,
            photo: avatarUrl
          } 
        },
        { new: true }
      ).select('-password');
      
      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        profileImage: avatarUrl,
        avatar: avatarUrl,
        user: updatedUser
      });
      
    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token. Please login again.' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to upload avatar' 
      });
    }
  });
});

// ==================== GOOGLE LOGIN API ====================
app.post('/api/auth/google', async (req, res) => {
  console.log('📥 Google login endpoint hit');
  
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    
    const decoded = jwt.decode(credential);
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google credential' });
    }
    
    const { email, name, picture, sub: googleId } = decoded;
    const User = require('./models/user.model');
    
    let user = await User.findOne({ 
      $or: [{ googleId: googleId }, { email: email.toLowerCase() }] 
    });
    
    if (!user) {
      console.log('👤 Creating new user from Google login');
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
    } else if (!user.googleId) {
      console.log('🔗 Linking Google account to existing user');
      user.googleId = googleId;
      if (picture && !user.profileImage) user.profileImage = picture;
      await user.save();
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'Purchase',
        contactNo: user.contactNo || '',
        organization: user.organization || 'Radiant Appliances',
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

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'LCGC RFQ Server is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== DIRECT MOBILE OTP ROUTES WITH FAST2SMS ====================

// Send Mobile OTP
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
    
    let cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.startsWith('91')) cleanMobile = cleanMobile.substring(2);
    if (cleanMobile.startsWith('0')) cleanMobile = cleanMobile.substring(1);
    
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit mobile number' 
      });
    }
    
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
    
    // Generate OTP
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
    
    // Try to send SMS via Fast2SMS
    const smsResult = await sendSmsViaFast2SMS(cleanMobile, otp);
    
    if (smsResult.success) {
      res.json({
        success: true,
        message: `OTP sent successfully to ${mobile}`,
        method: 'mobile',
        provider: 'fast2sms'
      });
    } else {
      // Still return success with dev OTP for testing
      res.json({
        success: true,
        message: `OTP generated. SMS delivery issue: ${smsResult.error || 'Unknown error'}`,
        method: 'mobile',
        devOTP: otp,
        note: 'Use this OTP for testing'
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
    if (cleanMobile.startsWith('91')) cleanMobile = cleanMobile.substring(2);
    if (cleanMobile.startsWith('0')) cleanMobile = cleanMobile.substring(1);
    
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
        message: 'OTP has expired' 
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

// ==================== PASSWORD RESET ROUTES ====================

// Send password reset link to email
app.post('/api/auth/forgot-password-link', async (req, res) => {
  try {
    const { email } = req.body;
    const User = require('./models/user.model');
    const { sendMail } = require('./services/mail.service');
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, message: 'If your email is registered, you will receive a reset link.' });
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Password Reset</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h2>Password Reset Request</h2>
        <p>Hello ${user.name},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </body>
      </html>
    `;
    
    await sendMail({ to: user.email, subject: 'Password Reset Request', html });
    res.json({ success: true, message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset password with token
app.post('/api/auth/reset-password-with-token', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const User = require('./models/user.model');
    
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check reset token validity
app.get('/api/auth/check-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    const User = require('./models/user.model');
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token required' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    
    res.json({ success: true, message: 'Token is valid', email: user.email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AUTH PROFILE ENDPOINTS ====================
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user: user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

app.get('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    const user = await User.findById(decoded.id).select('-password');
    
    res.json({ success: true, user: user });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

app.patch('/api/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/auth/avatar', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { $set: { avatar: '', profileImage: '' } },
      { new: true }
    ).select('-password');
    
    res.json({ success: true, message: 'Avatar removed successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== NPP CONTROLLER ====================
let nppController;
try {
  nppController = require('./controllers/npp.controller');
  console.log('✅ NPP Controller loaded');
} catch (err) {
  console.warn('⚠️ NPP Controller not found, creating fallback');
  nppController = {
    createNppRequest: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    getAllNppRequests: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    getNppStats: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    getNppRequestById: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    getNppRequestBySerialNo: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    updateNppRequest: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    deleteNppRequest: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    approveNppRequest: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    rejectNppRequest: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' }),
    sendNppRequestEmail: (req, res) => res.status(501).json({ success: false, message: 'NPP API coming soon' })
  };
}

// Cash Purchase
app.post('/api/npp/cash-purchase', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/new-vendor', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/rfq-vendor', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/rfq-requisition', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/vendor-list', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/employee-detail', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/item-master', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/quotation-comparison', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/pr-request', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/po-npp', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/payment-advise', authMiddleware, nppController.createNppRequest);
app.post('/api/npp/wcc-npp', authMiddleware, nppController.createNppRequest);

// Get all NPP requests
app.get('/api/npp/requests', authMiddleware, nppController.getAllNppRequests);
app.get('/api/npp/stats', authMiddleware, nppController.getNppStats);
app.get('/api/npp/request/:id', authMiddleware, nppController.getNppRequestById);
app.get('/api/npp/serial/:serialNo', authMiddleware, nppController.getNppRequestBySerialNo);

// Update and delete
app.put('/api/npp/request/:id', authMiddleware, nppController.updateNppRequest);
app.delete('/api/npp/request/:id', authMiddleware, nppController.deleteNppRequest);

// Approve/Reject
app.patch('/api/npp/request/:id/approve', authMiddleware, nppController.approveNppRequest);
app.patch('/api/npp/request/:id/reject', authMiddleware, nppController.rejectNppRequest);
app.post('/api/npp/request/:id/send-email', authMiddleware, nppController.sendNppRequestEmail);

console.log('✅ NPP Procurement routes loaded');
// ==================== API ROUTES ====================
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/rfq", rfqRoutes);
app.use("/api/pr-npp", prNppRoutes);
app.use("/api/po-npp", poNppRoutes);
app.use("/api/payment-npp", paymentNppRoutes);
app.use("/api/order-history", orderHistoryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/serial-number", serialNumberRoutes);
app.use("/api/part", partRoutes);
app.use("/api/users", userRoutes);
app.use('/api/ep-approval', requestRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LCGC RFQ API Running Successfully 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    availableApis: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        sendMobileOTP: "POST /api/auth/send-mobile-otp",
        verifyMobileOTP: "POST /api/auth/verify-mobile-otp",
        forgotPasswordLink: "POST /api/auth/forgot-password-link",
        resetPasswordWithToken: "POST /api/auth/reset-password-with-token",
        checkResetToken: "GET /api/auth/check-reset-token",
        googleLogin: "POST /api/auth/google",
        uploadAvatar: "POST /api/auth/upload-avatar",
        deleteAvatar: "DELETE /api/auth/avatar"
      },
      npp: {
        getAllRequests: "GET /api/npp/requests",
        getStats: "GET /api/npp/stats",
        approve: "PATCH /api/npp/request/:id/approve",
        reject: "PATCH /api/npp/request/:id/reject"
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Avatar upload: POST /api/auth/upload-avatar`);
  console.log(`✅ Mobile OTP: POST /api/auth/send-mobile-otp`);
  console.log(`✅ Password Reset: POST /api/auth/forgot-password-link`);
  console.log(`✅ Google Login: POST /api/auth/google`);
});

module.exports = app;