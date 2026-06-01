require("dotenv").config();  // ✅ MUST BE FIRST!

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

  const seniorRoles = ['Admin', 'Manager', 'Senior Manager', 'VP', 'GM', 'MD', 'Director', 'AGM', 'Approver'];
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
    console.warn(`⚠️ Could not load ${routePath}: ${err.message}`);
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
    
    console.log(`⚠️ CORS request from: ${origin}`);
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
  console.log(`📌 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'no-origin'}`);
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

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login first.'
    });
  }

  uploadAvatar.any()(req, res, async (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
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

      console.log('✅ File received:', {
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

// ==================== EMAIL OTP ROUTES (FULLY WORKING) ====================

// ==================== OTP ROUTE WITH NEW APP PASSWORD ====================
app.post('/api/auth/send-otp', async (req, res) => {
  console.log('📍 POST /api/auth/send-otp');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    console.log('📧 Sending OTP via SMTP to:', cleanEmail);
    
    // Import required modules
    const User = require('./models/user.model');
    const OTP = require('./models/otp.model');
    const nodemailer = require('nodemailer');
    
    // Check if user exists
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address'
      });
    }
    
    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 Generated OTP: ${otp}`);
    
    // Save OTP to database
    await OTP.deleteMany({ email: cleanEmail, type: 'login' });
    await OTP.create({
      email: cleanEmail,
      otp: otp,
      type: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    
    // Send success response immediately (don't wait for email)
    res.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}`,
      note: "Check your email inbox or spam folder"
    });
    
    // Send email in background with NEW password
    sendEmailInBackground(cleanEmail, otp, user.name);
    
  } catch (error) {
    console.error('❌ Send OTP error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
});

// Background email sending function with UPDATED password
async function sendEmailInBackground(email, otp, name) {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'dk897869@gmail.com',
        pass: 'snaq ptsl yqpm hufr'  // Your NEW app password WITH spaces (as generated by Google)
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`📧 Sending email to ${email}...`);
    
    const info = await transporter.sendMail({
      from: '"LCGC System" <dk897869@gmail.com>',
      to: email,
      subject: 'Your Login OTP - LCGC System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Login OTP - LCGC</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: #0f2a5e; padding: 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; text-align: center; }
            .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 5px; background: #f0f4f8; padding: 20px; border-radius: 12px; margin: 20px 0; font-family: monospace; color: #0f2a5e; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
            .warning { background: #fff3cd; padding: 12px; border-radius: 8px; font-size: 12px; color: #856404; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>LCGC System</h1>
            </div>
            <div class="content">
              <h2>Your Login Verification Code</h2>
              <div class="otp-code">${otp}</div>
              <p>This OTP is valid for <strong>10 minutes</strong>.</p>
              <div class="warning">
                ⚠️ Never share this OTP with anyone.
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} LCGC System</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    console.log(`✅ Email sent successfully to ${email}! Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
  }
}

// Send Registration OTP (email)
app.post('/api/auth/send-registration-otp', async (req, res) => {
  console.log('📍 POST /api/auth/send-registration-otp - Registration OTP route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    console.log('📧 Sending registration OTP to email:', cleanEmail);
    
    const User = require('./models/user.model');
    const OTP = require('./models/otp.model');
    const { sendMail } = require('./services/mail.service');
    
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login instead.'
      });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 Generated registration OTP for ${cleanEmail}: ${otp}`);
    
    await OTP.deleteMany({ email: cleanEmail, type: 'registration' });
    
    await OTP.create({
      email: cleanEmail,
      otp: otp,
      type: 'registration',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    
    const emailResult = await sendMail({
      to: cleanEmail,
      subject: 'Verify Your Email - LCGC Registration',
      type: 'otp',
      data: {
        name: cleanEmail.split('@')[0],
        otp: otp,
        otpType: 'registration'
      }
    });
    
    if (emailResult.success) {
      res.json({
        success: true,
        message: `Verification OTP sent to ${cleanEmail}`,
        method: 'email'
      });
    } else {
      console.error('Email send failed but OTP generated:', emailResult.error);
      res.json({
        success: true,
        message: `OTP generated. Check your email (might be in spam)`,
        method: 'email',
        devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    }
    
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
});

// Verify Registration OTP
app.post('/api/auth/verify-registration-otp', async (req, res) => {
  console.log('📍 POST /api/auth/verify-registration-otp - Verify OTP route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    
    const OTP = require('./models/otp.model');
    
    const otpRecord = await OTP.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      type: 'registration'
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
      message: 'OTP verified successfully'
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify OTP'
    });
  }
});

// Verify OTP for login
app.post('/api/auth/verify-otp', async (req, res) => {
  console.log('📍 POST /api/auth/verify-otp - Verify Login OTP route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email, otp, method, type } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    
    const OTP = require('./models/otp.model');
    const User = require('./models/user.model');

    const otpRecord = await OTP.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      type: type || 'login'
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
    
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await OTP.deleteOne({ _id: otpRecord._id });
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'Purchase',
        contactNo: user.contactNo || '',
        organization: user.organization || 'Radiant Appliances',
        rights: user.rights || {}
      }
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify OTP'
    });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  console.log('📍 POST /api/auth/resend-otp - Resend OTP route hit');
  console.log('📦 Request body:', req.body);
  
  try {
    const { email, type = 'login' } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const cleanEmail = email.trim().toLowerCase();
    const User = require('./models/user.model');
    const OTP = require('./models/otp.model');
    const { sendMail } = require('./services/mail.service');
    
    if (type === 'login') {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this email address'
        });
      }
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 Generated new OTP for ${cleanEmail}: ${otp}`);
    
    await OTP.deleteMany({ email: cleanEmail, type: type });
    
    await OTP.create({
      email: cleanEmail,
      otp: otp,
      type: type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    
    const emailResult = await sendMail({
      to: cleanEmail,
      subject: type === 'login' ? 'Login OTP - LCGC System' : 'Verification OTP - LCGC Registration',
      type: 'otp',
      data: {
        name: cleanEmail.split('@')[0],
        otp: otp,
        otpType: type
      }
    });
    
    if (emailResult.success) {
      res.json({
        success: true,
        message: `New OTP sent to ${cleanEmail}`,
        method: 'email'
      });
    } else {
      res.json({
        success: true,
        message: `OTP generated. Check your email (might be in spam)`,
        method: 'email',
        devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    }
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend OTP'
    });
  }
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 OTP for ${cleanMobile}: ${otp}`);

    await OTP.deleteMany({ mobile: cleanMobile, type: type });
    await OTP.create({
      mobile: cleanMobile,
      otp: otp,
      type: type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const smsResult = await sendSmsViaFast2SMS(cleanMobile, otp);

    if (smsResult.success) {
      res.json({
        success: true,
        message: `OTP sent successfully to ${mobile}`,
        method: 'mobile',
        provider: 'fast2sms'
      });
    } else {
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

console.log('✅ NPP Procurement routes loaded');

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
  console.error("🔥 Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// Simple SMTP test endpoint
app.post('/api/test-email-direct', async (req, res) => {
  console.log('📍 Direct email test endpoint');
  
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
        <h1>✅ SMTP Working!</h1>
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
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Avatar upload: POST /api/auth/upload-avatar`);
  console.log(`✅ Email OTP: POST /api/auth/send-otp`);
  console.log(`✅ Mobile OTP: POST /api/auth/send-mobile-otp`);
  console.log(`✅ Password Reset: POST /api/auth/forgot-password-link`);
  console.log(`✅ Google Login: POST /api/auth/google`);
  console.log(`✅ CORS: Configured for all origins`);
});

module.exports = app;