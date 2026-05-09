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

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads", "avatars");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// Database connection
connectDB();

// CORS Configuration
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

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log(`🌐 CORS request from: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin', 'Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Additional CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin');
  
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

app.post('/api/auth/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || !req.file) {
      return res.status(401).json({ success: false, message: 'No token or file provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { $set: { avatar: avatarUrl, profileImage: avatarUrl } },
      { new: true }
    ).select('-password');
    
    res.json({ success: true, message: 'Avatar uploaded successfully', profileImage: avatarUrl, user: updatedUser });
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
// Import NPP controller (will be created)
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

// ==================== NPP DIRECT API ROUTES ====================
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

app.get('/api/npp/requests', authMiddleware, nppController.getAllNppRequests);
app.get('/api/npp/stats', authMiddleware, nppController.getNppStats);
app.get('/api/npp/request/:id', authMiddleware, nppController.getNppRequestById);
app.get('/api/npp/serial/:serialNo', authMiddleware, nppController.getNppRequestBySerialNo);

app.put('/api/npp/request/:id', authMiddleware, nppController.updateNppRequest);
app.delete('/api/npp/request/:id', authMiddleware, nppController.deleteNppRequest);

app.patch('/api/npp/request/:id/approve', authMiddleware, nppController.approveNppRequest);
app.patch('/api/npp/request/:id/reject', authMiddleware, nppController.rejectNppRequest);
app.post('/api/npp/request/:id/send-email', authMiddleware, nppController.sendNppRequestEmail);

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
        forgotPasswordLink: "POST /api/auth/forgot-password-link",
        resetPasswordWithToken: "POST /api/auth/reset-password-with-token",
        checkResetToken: "GET /api/auth/check-reset-token",
        googleLogin: "POST /api/auth/google"
      },
      npp: {
        cashPurchase: "POST /api/npp/cash-purchase",
        newVendor: "POST /api/npp/new-vendor",
        rfqVendor: "POST /api/npp/rfq-vendor",
        rfqRequisition: "POST /api/npp/rfq-requisition",
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
  console.log(`✅ NPP APIs available at: http://localhost:${PORT}/api/npp`);
  console.log(`✅ Password Reset APIs:`);
  console.log(`   - POST   /api/auth/forgot-password-link`);
  console.log(`   - POST   /api/auth/reset-password-with-token`);
  console.log(`   - GET    /api/auth/check-reset-token`);
  console.log(`   - POST   /api/auth/google`);
});

module.exports = app;