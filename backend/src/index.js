require("dotenv").config();  // ✅ MUST BE FIRST!

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const connectDB = require("./config/db");

// Helper function to safely require routes - prevents crashes if files don't exist
const safeRequire = (routePath, defaultValue) => {
  try {
    return require(routePath);
  } catch (err) {
    console.warn(`⚠️ Could not load ${routePath}: ${err.message}`);
    return defaultValue || ((req, res) => res.status(501).json({ 
      success: false, 
      message: `${routePath} API not available yet`
    }));
  }
};

// ROUTES - using safe require to prevent crashes
const authRoutes = safeRequire("./routes/auth.routes");
const dashboardRoutes = safeRequire("./routes/dashboard.routes");
const requestRoutes = safeRequire("./routes/request.routes");
const vendorRoutes = safeRequire("./routes/vendor.routes");
const partRoutes = safeRequire("./routes/part.routes");
const userRoutes = safeRequire("./routes/user.routes");

// NPP PROCUREMENT ROUTES
const paymentNppRoutes = safeRequire("./routes/paymentNpp.routes");
const poNppRoutes = safeRequire("./routes/poNpp.routes");
const prNppRoutes = safeRequire("./routes/prNpp.routes");
const rfqRoutes = safeRequire("./routes/rfq.routes");

// NEW API ROUTES
const orderHistoryRoutes = safeRequire("./routes/orderHistory.routes");
const reportRoutes = safeRequire("./routes/report.routes");
const approvalRoutes = safeRequire("./routes/approval.routes");
const serialNumberRoutes = safeRequire("./routes/serialNumber.routes");

const app = express();

// ==================== FILE UPLOAD CONFIGURATION ====================
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

// ==================== DATABASE CONNECTION ====================
connectDB();

// ==================== CORS CONFIGURATION - FIXED FOR RENDER ====================
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:10000',
  'https://lcgc-rfq.onrender.com',
  'https://lcgc-rfq-frontend.onrender.com',
  'https://*.onrender.com',
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL
].filter(Boolean);

// CORS middleware - Most permissive for production
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Allow any render.com subdomain
    if (origin && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For debugging - log blocked origins but still allow (temporarily)
    console.log(`🌐 CORS request from: ${origin}`);
    return callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin', 'Cookie'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Additional CORS headers for safety
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ==================== SECURITY & LOGGING MIDDLEWARE ====================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false // Disable CSP for easier debugging
}));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Request logging (always on for debugging)
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// ==================== HELPER FUNCTION ====================
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
  console.log('Origin:', req.headers.origin);
  
  try {
    const { credential } = req.body;
    
    if (!credential) {
      console.log('❌ No credential provided');
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    
    // Decode the Google JWT token
    const decoded = jwt.decode(credential);
    
    if (!decoded || !decoded.email) {
      console.log('❌ Invalid token structure');
      return res.status(400).json({ success: false, message: 'Invalid Google credential' });
    }
    
    const { email, name, picture, sub: googleId } = decoded;
    const User = require('./models/user.model');
    
    // Find or create user
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
    } else {
      console.log('✅ Existing user found:', user.email);
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate token
    const token = generateToken(user);
    
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

// ==================== GOOGLE LOGIN WITH ID TOKEN ====================
app.post('/api/auth/google-idtoken', async (req, res) => {
  console.log('📥 Google ID token login endpoint hit');
  
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }
    
    const decoded = jwt.decode(idToken);
    
    if (!decoded || !decoded.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    
    const { email, name, picture, sub: googleId } = decoded;
    const User = require('./models/user.model');
    
    let user = await User.findOne({ 
      $or: [{ googleId: googleId }, { email: email.toLowerCase() }] 
    });
    
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
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (picture && !user.profileImage) user.profileImage = picture;
      await user.save();
    }
    
    const token = generateToken(user);
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || '',
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error('Google ID token login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== HEALTH CHECK ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'LCGC RFQ Server is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
    cors: 'enabled'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
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
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
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
    
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/auth/profile', async (req, res) => {
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
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
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
    
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const User = require('./models/user.model');
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      { $set: { avatar: avatarUrl, profileImage: avatarUrl } },
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
    console.error('Upload error:', error);
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
    
    res.json({ 
      success: true, 
      message: 'Avatar removed successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// Optional routes
const otpRoutes = safeRequire("./routes/otp.routes");
app.use("/api/otp", otpRoutes);

// User rights route
try {
  const userRightRoutes = require("./routes/userRight.routes");
  app.use("/api/user-rights", userRightRoutes);
  console.log("✅ userRight.routes loaded successfully");
} catch (error) {
  console.warn("⚠️ userRight.routes not found - skipping");
}

// ==================== ROOT ENDPOINT ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LCGC RFQ API Running Successfully 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    cors: "enabled",
    availableApis: {
      auth: "/api/auth",
      googleLogin: "/api/auth/google",
      health: "/api/health",
      dashboard: "/api/dashboard",
      epApproval: "/api/ep-approval",
      request: "/api/request",
      vendor: "/api/vendor",
      part: "/api/part",
      rfq: "/api/rfq",
      prNpp: "/api/pr-npp",
      poNpp: "/api/po-npp",
      paymentNpp: "/api/payment-npp"
    }
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    hint: 'Available routes: GET /api/health | POST /api/auth/login | POST /api/auth/google | GET /api/auth/me | GET /api/request | GET /api/ep-approval | GET /api/dashboard | GET /health | PATCH /api/auth/profile | POST /api/auth/change-password | POST /api/auth/upload-avatar | DELETE /api/auth/avatar | POST /api/pr-npp | POST /api/po-npp | POST /api/payment-npp'
  });
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  if (process.env.NODE_ENV !== "production") {
    console.error("Stack:", err.stack);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 ========================================`);
  console.log(`🚀 SERVER RUNNING SUCCESSFULLY`);
  console.log(`🚀 ========================================`);
  console.log(`📍 Local:       http://localhost:${PORT}`);
  console.log(`📍 Health:      http://localhost:${PORT}/api/health`);
  console.log(`📍 API Base:     http://localhost:${PORT}/api`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CORS:        Enabled for all origins`);
  console.log(`\n✅ Available Endpoints:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   POST   /api/auth/google (GOOGLE LOGIN)`);
  console.log(`   POST   /api/auth/google-idtoken`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/auth/profile`);
  console.log(`   PATCH  /api/auth/profile`);
  console.log(`   POST   /api/auth/change-password`);
  console.log(`   POST   /api/auth/upload-avatar`);
  console.log(`   DELETE /api/auth/avatar`);
  console.log(`   GET    /api/health`);
  console.log(`\n📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`\n✨ Ready to accept requests!\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;