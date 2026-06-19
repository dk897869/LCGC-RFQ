require("dotenv").config();  // âœ… MUST BE FIRST!

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const axios = require("axios");

const connectDB = require("./config/db");
// ==================== DEFINE AUTH MIDDLEWARE FIRST ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    // âœ… Require User model HERE - not at the top level
    const User = require('./models/user.model');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const moduleAccessMiddleware = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'No user found' });
  }

  const seniorRoles = ['Admin', 'Manager', 'Senior Manager', 'Vendor', 'VP', 'GM', 'MD', 'Director', 'AGM', 'Approver'];
  if (seniorRoles.includes(user.role)) {
    return next();
  }

  const rights = user.rights || {};
  if (Object.values(rights.toObject ? rights.toObject() : rights).some(Boolean)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Module access not granted. Please send an access request to admin or manager.',
    accessRequest: user.accessRequest || { status: 'none' }
  });
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
    console.warn(`âš ï¸ Could not load ${routePath}: ${err.message}`);
    return defaultValue || ((req, res) => res.status(501).json({
      success: false,
      message: `${routePath} API not available yet`
    }));
  }
};

// ROUTES
const authRoutes = safeRequire("./routes/auth.routes");
// Add this line with other route requires
const certificateRoutes = require('./routes/certificate.routes');
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
const nppFormsRoutes = safeRequire("./routes/nppForms.routes");
const notificationRoutes = safeRequire("./routes/notifications.routes");

const app = express();

// ==================== MULTER CONFIGURATION FOR AVATAR ====================
const avatarUploadDir = path.join(__dirname, "uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

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

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
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

// Update CORS configuration in index.js
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://lcgc-rfq.onrender.com',
  'https://lcgc-rfq-frontend.onrender.com',
  'https://lcgc-rfq.onrender.com'  // Your frontend domain
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Allow any *.onrender.com subdomain
    if (origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    // Check exact allowlist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log(`âš ï¸ CORS request from: ${origin}`);
    // Allow it anyway for production
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  optionsSuccessStatus: 204,
  maxAge: 86400
};
app.use(cors(corsOptions));

app.options('/{*path}', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cache-Control');
  next();
});

// Security middleware (after CORS)
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

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`ðŸ“Œ ${req.method} ${req.url} - Origin: ${req.headers.origin || 'no-origin'}`);
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


// Mobile SMS handled by auth.routes -> twilio.service (Fast2SMS fallback)

// ==================== AVATAR UPLOAD ROUTE ====================
app.post('/api/auth/upload-avatar', (req, res) => {
  console.log('ðŸ“ /api/auth/upload-avatar route hit');

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login first.'
    });
  }

  uploadAvatar.any()(req, res, async (err) => {
    if (err) {
      console.error('âŒ Upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const uploadedFile = req.files && req.files[0];

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          message: 'No image file uploaded. Please select an image file.'
        });
      }

      console.log('âœ… File received:', {
        fieldname: uploadedFile.fieldname,
        originalname: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size
      });

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
      console.error('âŒ Avatar upload error:', error);

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
  console.log('ðŸ“¥ Google login endpoint hit');

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
      console.log('ðŸ‘¤ Creating new user from Google login');
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
      console.log('âœ… New user created:', user.email);
    } else if (!user.googleId) {
      console.log('ðŸ”— Linking Google account to existing user');
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
    console.error('âŒ Google login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (req, res) => {
  const { verifySmtpConnection } = require('./services/mail.service');
  let smtpStatus = { configured: false, ready: false };
  try {
    smtpStatus = await verifySmtpConnection();
  } catch (e) {
    smtpStatus = { configured: false, ready: false, error: e.message };
  }
  res.json({
    success: true,
    status: 'ok',
    message: 'LCGC RFQ Server is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
    smtp: smtpStatus,
    frontendUrl: process.env.FRONTEND_URL || null
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// OTP, registration OTP, mobile OTP, verify/resend OTP routes are handled by
// auth.routes.js â†’ auth.controller.js using env-based mail.service (SMTP) and Fast2SMS/Twilio.

// ==================== PASSWORD RESET ROUTES ====================

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
  console.log('âœ… NPP Controller loaded');
} catch (err) {
  console.warn('âš ï¸ NPP Controller not found, creating fallback');
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
app.post('/api/npp/cash-purchase', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/new-vendor', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/rfq-vendor', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/rfq-requisition', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/vendor-list', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/employee-detail', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/item-master', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/quotation-comparison', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/pr-request', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/po-npp', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/payment-advise', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);
app.post('/api/npp/wcc-npp', authMiddleware, moduleAccessMiddleware, nppController.createNppRequest);

app.get('/api/npp/requests', authMiddleware, moduleAccessMiddleware, nppController.getAllNppRequests);
app.get('/api/npp/stats', authMiddleware, moduleAccessMiddleware, nppController.getNppStats);
app.get('/api/npp/request/:id', authMiddleware, moduleAccessMiddleware, nppController.getNppRequestById);
app.get('/api/npp/serial/:serialNo', authMiddleware, moduleAccessMiddleware, nppController.getNppRequestBySerialNo);

app.put('/api/npp/request/:id', authMiddleware, moduleAccessMiddleware, nppController.updateNppRequest);
app.delete('/api/npp/request/:id', authMiddleware, moduleAccessMiddleware, nppController.deleteNppRequest);

app.patch('/api/npp/request/:id/approve', authMiddleware, moduleAccessMiddleware, nppController.approveNppRequest);
app.patch('/api/npp/request/:id/reject', authMiddleware, moduleAccessMiddleware, nppController.rejectNppRequest);
app.post('/api/npp/request/:id/send-email', authMiddleware, moduleAccessMiddleware, nppController.sendNppRequestEmail);
app.use('/api/certificates', certificateRoutes);

console.log('âœ… NPP Procurement routes loaded');

// ==================== API ROUTES ====================
app.use([
  "/api/rfq",
  "/api/pr-npp",
  "/api/po-npp",
  "/api/payment-npp",
  "/api/request",
  "/api/approvals",
  "/api/ep-approval"
], authMiddleware, moduleAccessMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/rfq", rfqRoutes);
app.use("/api/pr-npp", prNppRoutes);
app.use("/api/pr", prNppRoutes);
app.use("/api/po-npp", poNppRoutes);
app.use("/api/payment-npp", paymentNppRoutes);
app.use("/api/order-history", orderHistoryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/npp-forms", nppFormsRoutes);
app.use("/api/forms", nppFormsRoutes);
app.use("/api/serial-number", serialNumberRoutes);
app.use("/api/part", partRoutes);
app.use("/api/users", userRoutes);
app.use('/api/ep-approval', requestRoutes);
app.use('/api/notifications', authMiddleware, moduleAccessMiddleware, notificationRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LCGC RFQ API Running Successfully ðŸš€",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    availableApis: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        sendOTP: "POST /api/auth/send-otp",
        sendRegistrationOTP: "POST /api/auth/send-registration-otp",
        verifyOTP: "POST /api/auth/verify-otp",
        verifyRegistrationOTP: "POST /api/auth/verify-registration-otp",
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
  console.error("ðŸ”¥ Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// Simple SMTP test endpoint
app.post('/api/test-email-direct', async (req, res) => {
  console.log('ðŸ“ Direct email test endpoint');
  
  try {
    const { email } = req.body;
    const testEmail = email || 'dk897869@gmail.com';
    
    const nodemailer = require('nodemailer');
    
    // Create transporter with NEW password
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'dk897869@gmail.com',
        pass: 'snaq ptsl yqpm hufr'  // Your NEW app password WITH spaces
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verify connection first
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified');
    
    // Send test email
    const info = await transporter.sendMail({
      from: '"LCGC System" <dk897869@gmail.com>',
      to: testEmail,
      subject: 'Direct SMTP Test from LCGC',
      html: `
        <h1>âœ… SMTP Working!</h1>
        <p>This email was sent directly from your backend.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>If you received this, your SMTP configuration is correct!</p>
      `
    });
    
    console.log('Email sent:', info.messageId);
    
    res.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.toString()
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nðŸš€ Server running on port ${PORT}`);
  console.log(`âœ… Health check: http://localhost:${PORT}/api/health`);
  console.log(`âœ… Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`âœ… Avatar upload: POST /api/auth/upload-avatar`);
  console.log(`âœ… Email OTP: POST /api/auth/send-otp`);
  console.log(`âœ… Mobile OTP: POST /api/auth/send-mobile-otp`);
  console.log(`âœ… Password Reset: POST /api/auth/forgot-password-link`);
  console.log(`âœ… Google Login: POST /api/auth/google`);
  console.log(`âœ… CORS: Configured for all origins`);
});

module.exports = app;
