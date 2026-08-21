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
const mongoose = require("mongoose");

const connectDB = require("./config/db");
// ==================== DEFINE AUTH MIDDLEWARE FIRST ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    // ✅ Require User model HERE - not at the top level
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

  const seniorRoles = ['Admin', 'Manager', 'Senior Manager', 'Vendor', 'VP', 'VP-Operation', 'GM', 'MD', 'Director', 'AGM', 'Approver', 'Purchase Head', 'Head - Purchase', 'Engineer'];
  if (seniorRoles.includes(user.role) || seniorRoles.includes(user.designation)) {
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
const notificationRoutes = safeRequire("./routes/notifications.routes");
const vendorRequestRoutes = require('./routes/vendorRequest.routes');
const quotationRoutes = require('./routes/quotation.routes');

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

// ==================== CORS CONFIGURATION ====================
// CORS must come FIRST before any route or middleware
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://lcgc-rfq.onrender.com',
  'https://lcgc-rfq-frontend.onrender.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any *.onrender.com subdomain
    if (origin.includes('.onrender.com')) return callback(null, true);
    // Allow localhost on any port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    // Check exact allowlist
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow everything else in production (open API)
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  optionsSuccessStatus: 204,
  maxAge: 86400
};

// Apply CORS globally — must be before ALL routes
app.use(cors(corsOptions));

// Preflight handler for all routes
app.options('/{*path}', cors(corsOptions));

// Extra safety: ensure CORS headers on every response
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

// ==================== INSTANT HEALTH CHECK ====================
// Registered AFTER CORS (so browser gets CORS headers) but BEFORE DB middleware (so never blocked)
app.get(['/health', '/api/health', '/api/auth/health'], (req, res) => {
  return res.status(200).json({
    status: 'ok',
    success: true,
    message: 'Server is healthy and responsive 🚀',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
    timestamp: new Date().toISOString()
  });
});

// ==================== DATABASE ====================
connectDB();

// DB readyState gate — blocks DB-dependent routes until connected
app.use((req, res, next) => {
  if (req.path.includes('/health')) return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is connecting. Please try again in a moment.'
    });
  }
  next();
});

// Security middleware (after CORS)
app.use(require('helmet')({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false
}));

// Body parsing middleware
app.use(require('express').json({ limit: "10mb" }));
app.use(require('express').urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", require('express').static(require('path').join(__dirname, "uploads")));

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.url}`);
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

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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

    // Use lean() for fastest possible DB read
    let user = await User.findOne({
      $or: [{ googleId: googleId }, { email: email.toLowerCase() }]
    }).select('name email role department contactNo organization profileImage rights mustChangePassword googleId').lean();

    if (!user) {
      const randomPassword = require('crypto').randomBytes(20).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const newUser = new User({
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
      await newUser.save();
      user = newUser.toObject();
    } else if (!user.googleId) {
      // Link Google account to existing user (non-blocking)
      User.updateOne({ _id: user._id }, { $set: { googleId, ...(picture && !user.profileImage ? { profileImage: picture } : {}) } }).catch(() => {});
    }

    // Fire-and-forget lastLogin update (non-blocking)
    User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } }).catch(() => {});

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        rights: user.rights || {}
      },
      process.env.JWT_SECRET || 'fallback_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

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
        profileImage: user.profileImage || picture || '',
        emailVerified: true,
        rights: user.rights || {}
      }
    });

  } catch (error) {
    console.error('❌ Google login error:', error);
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

// ==================== DASHBOARD & UNIFIED APPROVALS APIs ====================
// ==================== DASHBOARD & UNIFIED APPROVALS APIs ====================
app.get(['/api/dashboard', '/api/dashboard/stats', '/api/dashboard/full-stats'], async (req, res) => {
  try {
    const User = require('./models/user.model');
    const EPRequest = require('./models/request');
    const PRRequest = require('./models/PRRequest');
    const NPPRequest = require('./models/nppRequest.model');
    const RFQ = require('./models/Rfq');
    const PORequest = require('./models/PORequest');
    const Vendor = require('./models/vendor');
    const Part = require('./models/part');
    const OrderHistory = require('./models/OrderHistory');

    // 1. Basic Counts (100% Dynamic from MongoDB Collections)
    const [allEpRequests, allPrRequests, allNppRequests, allRfqs, allPos, activeVendors, partCount, totalUsers] = await Promise.all([
      EPRequest.find().select('_id status amount').lean().catch(() => []),
      PRRequest.find().select('_id status totalAmount').lean().catch(() => []),
      NPPRequest.find().select('_id status estimatedCost').lean().catch(() => []),
      RFQ.find().select('_id status estimatedCost').lean().catch(() => []),
      PORequest.find().select('_id status totalAmount').lean().catch(() => []),
      Vendor.countDocuments().catch(() => 0),
      Part.countDocuments().catch(() => 0),
      User.countDocuments().catch(() => 0)
    ]);

    const allCombinedRequests = [
      ...allEpRequests,
      ...allPrRequests,
      ...allNppRequests,
      ...allRfqs,
      ...allPos
    ];

    const totalRequests = allCombinedRequests.length;
    const totalPending = allCombinedRequests.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'pending' || s === 'in-process' || s === 'in process' || s === 'in progress';
    }).length;

    const totalApproved = allCombinedRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
    const totalRejected = allCombinedRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length;
    const totalCompleted = Math.max(0, totalRequests - (totalPending + totalApproved + totalRejected));

    const totalSpend = allCombinedRequests
      .filter(r => (r.status || '').toLowerCase() === 'approved')
      .reduce((sum, r) => sum + Number(r.amount || r.totalAmount || r.estimatedAmount || r.estimatedCost || 0), 0);

    // activeVendors and partCount are already fetched via countDocuments

    // 2. Fetch Live Recent RFQs & Requests
    const recentRfqsList = await RFQ.find().select('_id title department requester rfqNo uniqueSerialNo estimatedCost amount status createdAt responseBy createdBy').sort({ createdAt: -1 }).limit(10).lean().catch(() => []);

    // 3. Department Wise Requests (Dynamic Mongo Aggregation)
    const deptAgg = await RFQ.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]).catch(() => []);

    const departmentWise = deptAgg.map(d => ({
      name: d._id || 'General',
      count: d.count
    }));

    // 4. Vendor Spend Aggregation (Dynamic)
    const vendorAgg = await PORequest.aggregate([
      { $group: { _id: "$vendorName", totalSpend: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      { $sort: { totalSpend: -1 } },
      { $limit: 5 }
    ]).catch(() => []);

    const topVendors = vendorAgg.map(v => ({
      name: v._id || 'Vendor Partner',
      orders: v.count,
      totalSpend: v.totalSpend || 0,
      rating: 5
    }));

    // 5. System Activity (Dynamic from OrderHistory)
    const logs = await OrderHistory.find().sort({ timestamp: -1 }).limit(6).lean().catch(() => []);

    return res.json({
      success: true,
      data: {
        // Flat legacy fields for backward compatibility
        totalRequests,
        pending: totalPending,
        approved: totalApproved,
        successRate: totalRequests > 0 ? Math.round((totalApproved / totalRequests) * 100) : 0,
        vendorCount: activeVendors,
        partCount,
        
        // Full dynamic structure for Admin Dashboard
        kpi: {
          totalUsers,
          totalRfqs: allRfqs.length,
          purchaseRequests: allEpRequests.length,
          purchaseOrders: allPos.length,
          totalSpend,
          activeVendors,
          pendingApprovals: totalPending,
          approvedCount: totalApproved,
          rejectedCount: totalRejected,
          completedCount: totalCompleted,
          totalRequests
        },
        requestStatusDistribution: {
          pending: totalPending,
          approved: totalApproved,
          rejected: totalRejected,
          completed: totalCompleted,
          total: totalRequests
        },
        departmentWise,
        topVendors,
        recentRfqs: recentRfqsList.map(r => ({
          id: r._id,
          rfqNo: r.rfqNo || r.uniqueSerialNo || `RFQ-${r._id}`,
          title: r.title || r.subject || 'RFQ Request',
          department: r.department || 'Production',
          requestedBy: r.createdBy || r.requester || 'User',
          amount: r.estimatedCost || r.amount || 0,
          status: r.status || 'Pending Approval',
          createdDate: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          responseBy: r.responseBy ? new Date(r.responseBy).toISOString().split('T')[0] : 'In 5 Days'
        })),
        recentActivity: logs.map(l => ({
          text: l.details || l.action || 'System Action',
          time: l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : 'Recently',
          icon: '⚡'
        }))
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/approvals/unified', async (req, res) => {
  try {
    const EPRequest = require('./models/request');
    const PRRequest = require('./models/PRRequest');
    const NPPRequest = require('./models/nppRequest.model');
    const RFQ = require('./models/Rfq');
    const PORequest = require('./models/PORequest');

    const [epList, prList, nppList, rfqList, poList] = await Promise.all([
      EPRequest.find().select('-attachments -items.picturePreview -items.pictureName').sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
      PRRequest.find().select('-attachments -items.picturePreview -items.pictureName').sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
      NPPRequest.find().select('-attachments -items.picturePreview -items.pictureName').sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
      RFQ.find().select('-attachments -items.picturePreview -items.pictureName').sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
      PORequest.find().select('-attachments -items.picturePreview -items.pictureName').sort({ createdAt: -1 }).limit(100).lean().catch(() => [])
    ]);

    const items = [];

    epList.forEach(r => items.push({
      ...r,
      id: r._id,
      _id: r._id,
      type: 'ep',
      uniqueSerialNo: r.uniqueSerialNo || r.serialNo || `EP-${r._id}`,
      title: r.titleOfActivity || r.title || 'EP Approval Request',
      requester: r.requesterName || r.requester || '',
      email: r.emailId || r.email || '',
      department: r.department || '',
      priority: r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: 0, // EP requests have no financial amount
      createdAt: r.createdAt,
      objective: r.objective || r.objectiveOfActivity || '',
      justification: r.justification || '',
      vendorName: r.vendorName || r.vendor || '',
      approvalChain: r.approvalChain || [],
      ccEmails: r.ccEmails || r.ccEmail || []
    }));

    prList.forEach(r => items.push({
      ...r,
      id: r._id,
      _id: r._id,
      type: 'pr',
      uniqueSerialNo: r.uniqueSerialNo || r.prNumber || `PR-${r._id}`,
      title: r.title || r.purpose || 'PR Request',
      requester: r.requesterName || r.createdBy || '',
      email: r.email || '',
      department: r.department || '',
      priority: r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: r.totalAmount || r.amount || 0,
      createdAt: r.createdAt
    }));

    nppList.forEach(r => items.push({
      ...r,
      id: r._id,
      _id: r._id,
      type: 'npp',
      uniqueSerialNo: r.uniqueSerialNo || r.requestId || `NPP-${r._id}`,
      title: r.title || r.projectTitle || 'NPP Request',
      requester: r.requesterName || r.requester || '',
      email: r.email || '',
      department: r.department || '',
      priority: r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: r.totalCost || r.amount || 0,
      createdAt: r.createdAt
    }));

    rfqList.forEach(r => items.push({
      ...r,
      id: r._id,
      _id: r._id,
      type: 'rfq',
      uniqueSerialNo: r.uniqueSerialNo || r.rfqNo || `RFQ-${r._id}`,
      title: r.title || r.subject || 'RFQ Request',
      itemDescription: r.itemDescription || r.description || r.title || '',
      partNo: r.partNo || r.partNumber || '',
      specification: r.specification || r.specifications || '',
      make: r.make || r.brand || '',
      requester: r.createdBy || r.requester || '',
      email: r.email || '',
      department: r.department || '',
      priority: r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: r.estimatedCost || r.amount || 0,
      createdAt: r.createdAt,
      approvalChain: r.approvalChain || [],
      ccEmails: r.ccEmails || r.ccEmail || []
    }));

    poList.forEach(r => items.push({
      ...r,
      id: r._id,
      _id: r._id,
      type: 'po',
      uniqueSerialNo: r.uniqueSerialNo || r.poNumber || `PO-${r._id}`,
      title: r.title || r.vendorName || 'PO Request',
      requester: r.createdBy || r.requester || '',
      email: r.email || '',
      department: r.department || '',
      priority: r.priority || 'Medium',
      status: r.status || 'Pending',
      amount: r.totalAmount || r.amount || 0,
      createdAt: r.createdAt
    }));

    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error('Unified approvals error:', err);
    return res.json({ success: true, data: [] });
  }
});

// ==================== UNIFIED APPROVAL & REJECTION ENDPOINTS ====================
app.patch('/api/approvals/:type/:id/approve', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { comments } = req.body || {};
    let updated = null;

    if (type === 'ep') {
      const EPRequest = require('./models/request');
      updated = await EPRequest.findByIdAndUpdate(id, { status: 'Approved', approvalComments: comments }, { new: true });
    } else if (type === 'pr') {
      const PRRequest = require('./models/PRRequest');
      updated = await PRRequest.findByIdAndUpdate(id, { status: 'Approved', comments }, { new: true });
    } else if (type === 'npp') {
      const NPPRequest = require('./models/nppRequest.model');
      updated = await NPPRequest.findByIdAndUpdate(id, { status: 'Approved', comments }, { new: true });
    } else if (type === 'rfq') {
      const RFQ = require('./models/Rfq');
      updated = await RFQ.findByIdAndUpdate(id, { status: 'Approved', comments }, { new: true });
    } else if (type === 'po') {
      const PORequest = require('./models/PORequest');
      updated = await PORequest.findByIdAndUpdate(id, { status: 'Approved', comments }, { new: true });
    }

    return res.json({ success: true, message: 'Request approved successfully', data: updated });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/approvals/:type/:id/reject', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { comments } = req.body || {};
    let updated = null;

    if (type === 'ep') {
      const EPRequest = require('./models/request');
      updated = await EPRequest.findByIdAndUpdate(id, { status: 'Rejected', approvalComments: comments }, { new: true });
    } else if (type === 'pr') {
      const PRRequest = require('./models/PRRequest');
      updated = await PRRequest.findByIdAndUpdate(id, { status: 'Rejected', comments }, { new: true });
    } else if (type === 'npp') {
      const NPPRequest = require('./models/nppRequest.model');
      updated = await NPPRequest.findByIdAndUpdate(id, { status: 'Rejected', comments }, { new: true });
    } else if (type === 'rfq') {
      const RFQ = require('./models/Rfq');
      updated = await RFQ.findByIdAndUpdate(id, { status: 'Rejected', comments }, { new: true });
    } else if (type === 'po') {
      const PORequest = require('./models/PORequest');
      updated = await PORequest.findByIdAndUpdate(id, { status: 'Rejected', comments }, { new: true });
    }

    return res.json({ success: true, message: 'Request rejected successfully', data: updated });
  } catch (err) {
    console.error('Reject error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/dashboard/notifications', async (req, res) => {
  return res.json({
    success: true,
    data: [
      { id: '1', title: 'System Active', message: 'All procurement services are operational', type: 'info', time: new Date().toISOString() }
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// OTP, registration OTP, mobile OTP, verify/resend OTP routes are handled by
// auth.routes.js → auth.controller.js using env-based mail.service (SMTP) and Fast2SMS/Twilio.

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
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
app.use('/api/vendor', authMiddleware, vendorRoutes);
app.use('/api/vendors', authMiddleware, vendorRoutes);  // ✅ ADDED - For backward compatibility

app.use('/api/notifications', authMiddleware, moduleAccessMiddleware, notificationRoutes);

// ✅ ADDED - Vendor Request routes
app.use('/api/vendor-request', authMiddleware, vendorRequestRoutes);
app.use('/api/vendor-requests', authMiddleware, vendorRequestRoutes);  // Plural version

// ✅ ADDED - Quotation routes
app.use('/api/quotation', authMiddleware, quotationRoutes);
app.use('/api/quotations', authMiddleware, quotationRoutes);  // Plural version

// ==================== ✅ FIXED: QUOTATION COMPARISON LATEST ENDPOINT ====================
// This handles the /api/pr/latest/comparison request that was failing
app.get('/api/pr/latest/comparison', authMiddleware, async (req, res) => {
  try {
    const NPPRequest = require('./models/nppRequest.model');
    
    // Find the most recent quotation comparison
    const latest = await NPPRequest.findOne({ 
      type: 'quotation-comparison',
      status: 'Submitted'
    }).sort({ createdAt: -1 });
    
    if (!latest) {
      // If no quotation comparison found, try to find any quotation submission
      const fallback = await NPPRequest.findOne({ 
        type: 'quotation-submission'
      }).sort({ createdAt: -1 });
      
      if (fallback) {
        return res.json({
          success: true,
          data: {
            rfqNo: fallback.rfqNo || fallback.uniqueSerialNo,
            items: fallback.quotationSubmissionItems || fallback.items || [],
            recommendedVendor: {
              vendorName: 'Supplier 1'
            },
            bestSupplier: 'Supplier 1',
            suppliers: ['Supplier 1', 'Supplier 2', 'Supplier 3'],
            recommendation: 'Please compare the quotations manually.'
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'No quotation comparison data found'
      });
    }
    
    res.json({
      success: true,
      data: {
        rfqNo: latest.rfqNo || latest.uniqueSerialNo,
        items: latest.quotationItems || latest.items || [],
        recommendedVendor: latest.recommendedVendor || {
          vendorName: latest.bestSupplier || 'Recommended Vendor'
        },
        bestSupplier: latest.bestSupplier || 'Recommended Vendor',
        suppliers: latest.suppliers || [],
        recommendation: latest.recommendation || ''
      }
    });
  } catch (error) {
    console.error('Get latest comparison error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ✅ ADDED: QUOTATION COMPARISON BY RFQ ENDPOINT ====================
app.get('/api/quotation/comparison/rfq/:rfqId', authMiddleware, async (req, res) => {
  try {
    const NPPRequest = require('./models/nppRequest.model');
    const rfqId = req.params.rfqId;
    
    const comparison = await NPPRequest.findOne({ 
      type: 'quotation-comparison',
      $or: [
        { rfqNo: rfqId },
        { uniqueSerialNo: rfqId },
        { 'rfqVendorItems.rfqNo': rfqId }
      ]
    }).sort({ createdAt: -1 });
    
    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: 'No comparison data found for this RFQ'
      });
    }
    
    res.json({
      success: true,
      data: {
        rfqNo: comparison.rfqNo || comparison.uniqueSerialNo,
        items: comparison.quotationItems || comparison.items || [],
        recommendedVendor: comparison.recommendedVendor || {
          vendorName: comparison.bestSupplier || 'Recommended Vendor'
        },
        bestSupplier: comparison.bestSupplier || 'Recommended Vendor',
        suppliers: comparison.suppliers || [],
        recommendation: comparison.recommendation || ''
      }
    });
  } catch (error) {
    console.error('Get comparison by RFQ error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ✅ NEW: QUOTATION COMPARISON SUBMIT ENDPOINT ====================
/**
 * POST /api/quotation-comparison/submit
 * Submit a quotation comparison
 */
app.post('/api/quotation-comparison/submit', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const data = req.body;
    console.log('📤 Received quotation comparison submission:', data.rfqNo);
    
    // Get the NPPRequest model
    const NPPRequest = require('./models/nppRequest.model');
    
    // Check if a comparison already exists for this RFQ
    const existing = await NPPRequest.findOne({
      type: 'quotation-comparison',
      $or: [
        { rfqNo: data.rfqNo },
        { rfqId: data.rfqId },
        { uniqueSerialNo: data.rfqNo }
      ]
    });
    
    let comparison;
    
    if (existing) {
      // Update existing comparison
      existing.quotationItems = data.quotationItems || [];
      existing.suppliers = data.suppliers || [];
      existing.bestSupplier = data.bestSupplier || '';
      existing.recommendation = data.recommendation || '';
      existing.selectedSupplier = data.selectedSupplier || '';
      existing.status = 'Submitted';
      existing.submittedAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      existing.conditionRows = data.conditionRows || [];
      existing.attachments = data.attachments || {};
      
      comparison = await existing.save();
      console.log('✅ Updated existing comparison:', comparison.rfqNo);
    } else {
      // Create new comparison
      const newComparison = new NPPRequest({
        type: 'quotation-comparison',
        rfqNo: data.rfqNo || data.rfqId,
        rfqId: data.rfqId || data.rfqNo,
        uniqueSerialNo: data.rfqNo || `COMP-${Date.now()}`,
        title: data.title || 'Quotation Comparison',
        requesterName: data.requester || '',
        emailId: data.requesterEmail || '',
        department: data.department || 'Purchase',
        priority: data.priority || 'M',
        status: 'Submitted',
        requestDate: data.date || new Date().toISOString(),
        suppliers: data.suppliers || [],
        bestSupplier: data.bestSupplier || '',
        amount: data.totalAmount || 0,
        quotationItems: data.quotationItems || [],
        recommendation: data.recommendation || '',
        selectedSupplier: data.selectedSupplier || '',
        conditionRows: data.conditionRows || [],
        attachments: data.attachments || {},
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      comparison = await newComparison.save();
      console.log('✅ Created new comparison:', comparison.rfqNo);
    }
    
    res.json({
      success: true,
      message: 'Quotation comparison submitted successfully',
      data: comparison,
      rfqNo: comparison.rfqNo
    });
    
  } catch (error) {
    console.error('❌ Error submitting quotation comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quotation comparison',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: GET ALL QUOTATION COMPARISONS ====================
/**
 * GET /api/quotation-comparison/list
 * Get all quotation comparisons
 */
app.get('/api/quotation-comparison/list', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const NPPRequest = require('./models/nppRequest.model');
    
    const comparisons = await NPPRequest.find({
      type: { $in: ['quotation-comparison', 'quotation-submission'] }
    }).sort({ createdAt: -1 });
    
    console.log(`📋 Found ${comparisons.length} comparisons`);
    
    // Format response to match frontend expectations
    const formatted = comparisons.map(comp => ({
      id: comp._id,
      rfqId: comp.rfqId || comp.uniqueSerialNo,
      rfqNo: comp.rfqNo || comp.uniqueSerialNo,
      title: comp.title || 'Quotation Comparison',
      requester: comp.requesterName || '',
      requesterEmail: comp.emailId || '',
      department: comp.department || 'Purchase',
      priority: comp.priority || 'M',
      status: comp.status || 'Pending',
      date: comp.requestDate || comp.createdAt,
      suppliers: comp.suppliers || [],
      bestSupplier: comp.bestSupplier || '',
      totalAmount: comp.amount || 0,
      quotationItems: comp.quotationItems || [],
      recommendation: comp.recommendation || '',
      selectedSupplier: comp.selectedSupplier || '',
      conditionRows: comp.conditionRows || [],
      attachments: comp.attachments || {},
      createdAt: comp.createdAt,
      updatedAt: comp.updatedAt
    }));
    
    res.json({
      success: true,
      data: formatted,
      total: formatted.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching comparisons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparisons',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: GET SUBMITTED QUOTATION COMPARISONS ====================
/**
 * GET /api/quotation-comparison/submitted
 * Get all submitted quotation comparisons
 */
app.get('/api/quotation-comparison/submitted', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const NPPRequest = require('./models/nppRequest.model');
    
    const comparisons = await NPPRequest.find({
      type: { $in: ['quotation-comparison', 'quotation-submission'] },
      status: 'Submitted'
    }).sort({ createdAt: -1 });
    
    console.log(`📋 Found ${comparisons.length} submitted comparisons`);
    
    const formatted = comparisons.map(comp => ({
      id: comp._id,
      rfqId: comp.rfqId || comp.uniqueSerialNo,
      rfqNo: comp.rfqNo || comp.uniqueSerialNo,
      title: comp.title || 'Quotation Comparison',
      requester: comp.requesterName || '',
      requesterEmail: comp.emailId || '',
      department: comp.department || 'Purchase',
      priority: comp.priority || 'M',
      status: comp.status || 'Submitted',
      date: comp.requestDate || comp.createdAt,
      suppliers: comp.suppliers || [],
      bestSupplier: comp.bestSupplier || '',
      totalAmount: comp.amount || 0,
      quotationItems: comp.quotationItems || [],
      recommendation: comp.recommendation || '',
      selectedSupplier: comp.selectedSupplier || '',
      conditionRows: comp.conditionRows || [],
      attachments: comp.attachments || {},
      createdAt: comp.createdAt,
      updatedAt: comp.updatedAt,
      submittedAt: comp.submittedAt || comp.updatedAt
    }));
    
    res.json({
      success: true,
      data: formatted,
      total: formatted.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching submitted comparisons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submitted comparisons',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: CREATE PR FROM COMPARISON ====================
/**
 * POST /api/pr/create-from-comparison
 * Create a Purchase Requisition from a comparison
 */
app.post('/api/pr/create-from-comparison', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const data = req.body;
    console.log('📤 Creating PR from comparison:', data.rfqNo);
    
    const NPPRequest = require('./models/nppRequest.model');
    
    // Create PR request using the correct model fields
    const newPR = new NPPRequest({
      type: 'pr-request',
      uniqueSerialNo: data.serialNo || data.prNumber || `PR-${Date.now()}`,
      rfqNo: data.rfqNo || '',
      titleOfActivity: data.titleOfActivity || data.title || 'PR from Quotation Comparison',
      requesterName: data.name || data.requester || '',
      emailId: data.emailId || data.requesterEmail || '',
      department: data.department || 'Purchase',
      contactNo: data.contactNo || '',
      organization: data.organization || 'Radiant Appliances',
      status: data.status || 'Pending',
      requestDate: data.submittedDate || new Date().toISOString(),
      prItems: (data.items || []).map(item => ({
        costCenter: data.costCenter || 'Purchase Department',
        supplierName: item.supplierName || '',
        rfqNo: data.rfqNo || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || '',
        specification: item.cndt || item.specification || '',
        cmdt: item.cndt || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        totalValue: item.value || (item.qty || 1) * (item.unitPrice || 0)
      })),
      amount: data.totalValue || 0,
      comparisonId: data.comparisonId || data.rfqId,
      submittedDate: data.submittedDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    const savedPR = await newPR.save();
    console.log('✅ PR created from comparison:', savedPR.uniqueSerialNo);
    
    res.json({
      success: true,
      message: 'PR created successfully from comparison',
      data: savedPR,
      prNumber: savedPR.uniqueSerialNo
    });
    
  } catch (error) {
    console.error('❌ Error creating PR from comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create PR from comparison',
      error: error.message
    });
  }
});

// Helper to auto-create PO when PR is fully approved
const autoCreatePOFromApprovedPR = async (pr) => {
  try {
    let PoNpp = null;
    let NPPRequest = null;
    try { PoNpp = require('./models/poNpp.model'); } catch (e) {}
    try { NPPRequest = require('./models/nppRequest.model'); } catch (e) {}

    const prSerial = pr.uniqueSerialNo || pr.prNumber || pr.serialNo || String(pr._id);

    if (PoNpp) {
      const existingPo = await PoNpp.findOne({ $or: [{ prNo: prSerial }, { uniqueSerialNo: `PO-${prSerial}` }] });
      if (existingPo) {
        console.log('ℹ️ PO already exists for PR:', prSerial);
        return existingPo;
      }
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const poSerialNo = `PO-${year}${month}${day}${hours}${minutes}-${random}`;

    const rawItems = pr.prItems || pr.items || pr.formData?.items || pr.formData?.prItems || [];
    const poItems = rawItems.map((item, idx) => ({
      id: idx + 1,
      partNo: item.partCode || item.partNo || '',
      itemDescription: item.partDescription || item.description || '',
      hsn: item.hsn || '',
      uom: item.uom || 'Nos',
      quantity: item.qty || item.quantity || 1,
      rate: item.unitPrice || item.rate || 0,
      discount: 0,
      gst: 18,
      deliveryDate: '',
      remark: item.remark || item.specification || item.cndt || ''
    }));

    const poData = {
      uniqueSerialNo: poSerialNo,
      orderNo: poSerialNo,
      prNo: prSerial,
      prId: pr._id,
      rfqNo: pr.rfqNo || pr.formData?.rfqNo || '',
      titleOfActivity: pr.titleOfActivity || pr.formData?.titleOfActivity || 'Purchase Order',
      requesterName: pr.requesterName || pr.name || pr.formData?.name || 'Requester',
      department: pr.department || pr.formData?.department || 'Purchase',
      emailId: pr.emailId || pr.formData?.emailId || '',
      contactNo: pr.contactNo || pr.formData?.contactNo || '',
      organization: pr.organization || pr.formData?.organization || 'Radiant Appliances',
      amount: pr.amount || pr.totalValue || pr.formData?.totalValue || 0,
      vendorName: pr.selectedSupplier || pr.formData?.selectedSupplier || pr.formData?.bestSupplier || (rawItems[0]?.supplierName) || 'Vendor',
      status: 'Approved',
      items: poItems,
      stakeholders: pr.stakeholders || pr.approvalChain || pr.formData?.approvalChain || [],
      attachments: pr.attachments || pr.formData?.attachments || [],
      ccList: pr.ccList || pr.formData?.ccList || []
    };

    if (PoNpp) {
      const newPo = new PoNpp(poData);
      await newPo.save();
      console.log('✅ Auto-created PO (PoNpp) from Approved PR:', poSerialNo);
    }

    if (NPPRequest) {
      const newNppPo = new NPPRequest({
        type: 'po-npp',
        uniqueSerialNo: poSerialNo,
        ...poData,
        formData: poData
      });
      await newNppPo.save();
      console.log('✅ Auto-created PO (NPPRequest) from Approved PR:', poSerialNo);
    }
  } catch (err) {
    console.error('⚠️ Error in autoCreatePOFromApprovedPR:', err.message);
  }
};

// ==================== ✅ NEW: SAVE PR (Draft) ====================
/**
 * POST /api/pr/save
 * Save PR as draft
 */
app.post('/api/pr/save', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const data = req.body;
    console.log('💾 Saving PR draft:', data.uniqueSerialNo || data.prNumber);
    
    const NPPRequest = require('./models/nppRequest.model');
    
    const approvers = data.approvalChain || data.stakeholders || [];
    const attachments = data.attachments || [];
    const ccList = data.ccList || [];

    // Check if PR exists
    const existing = await NPPRequest.findOne({
      type: 'pr-request',
      $or: [
        { uniqueSerialNo: data.uniqueSerialNo || data.prNumber || data.serialNo },
        { rfqNo: data.rfqNo }
      ]
    });
    
    let savedPR;
    
    if (existing) {
      existing.requesterName = data.name || data.requester || existing.requesterName;
      existing.department = data.department || existing.department;
      existing.emailId = data.emailId || data.requesterEmail || existing.emailId;
      existing.contactNo = data.contactNo || existing.contactNo;
      existing.organization = data.organization || existing.organization;
      existing.titleOfActivity = data.titleOfActivity || data.title || existing.titleOfActivity;
      existing.rfqNo = data.rfqNo || existing.rfqNo;
      existing.status = 'Draft';
      existing.stakeholders = approvers;
      existing.attachments = attachments;
      existing.ccList = ccList;
      existing.prItems = (data.items || []).map(item => ({
        costCenter: data.costCenter || 'Purchase Department',
        supplierName: item.supplierName || '',
        rfqNo: data.rfqNo || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || '',
        specification: item.cndt || item.specification || '',
        cmdt: item.cndt || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        totalValue: item.value || (item.qty || 1) * (item.unitPrice || 0)
      }));
      existing.amount = data.totalValue || 0;
      existing.formData = { ...data, approvalChain: approvers, stakeholders: approvers };
      existing.updatedAt = new Date().toISOString();
      
      savedPR = await existing.save();
      console.log('✅ PR draft updated:', savedPR.uniqueSerialNo);
    } else {
      const newPR = new NPPRequest({
        type: 'pr-request',
        uniqueSerialNo: data.uniqueSerialNo || data.prNumber || data.serialNo || `PR-${Date.now()}`,
        rfqNo: data.rfqNo || '',
        titleOfActivity: data.titleOfActivity || data.title || 'PR Request',
        requesterName: data.name || data.requester || '',
        emailId: data.emailId || data.requesterEmail || '',
        department: data.department || 'Purchase',
        contactNo: data.contactNo || '',
        organization: data.organization || 'Radiant Appliances',
        status: 'Draft',
        stakeholders: approvers,
        attachments: attachments,
        ccList: ccList,
        prItems: (data.items || []).map(item => ({
          costCenter: data.costCenter || 'Purchase Department',
          supplierName: item.supplierName || '',
          rfqNo: data.rfqNo || '',
          partCode: item.partCode || '',
          partDescription: item.partDescription || '',
          specification: item.cndt || item.specification || '',
          cmdt: item.cndt || '',
          uom: item.uom || 'Nos',
          qty: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          totalValue: item.value || (item.qty || 1) * (item.unitPrice || 0)
        })),
        amount: data.totalValue || 0,
        comparisonId: data.comparisonId || data.rfqId,
        formData: { ...data, approvalChain: approvers, stakeholders: approvers },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      savedPR = await newPR.save();
      console.log('✅ New PR draft created:', savedPR.uniqueSerialNo);
    }
    
    res.json({
      success: true,
      message: 'PR saved successfully',
      data: savedPR,
      prNumber: savedPR.uniqueSerialNo
    });
    
  } catch (error) {
    console.error('❌ Error saving PR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save PR',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: SUBMIT PR ====================
/**
 * POST /api/pr/submit
 * Submit PR for approval
 */
app.post('/api/pr/submit', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const data = req.body;
    console.log('📤 Submitting PR:', data.uniqueSerialNo || data.prNumber);
    
    const NPPRequest = require('./models/nppRequest.model');
    
    const approvers = data.approvalChain || data.stakeholders || [];
    const attachments = data.attachments || [];
    const ccList = data.ccList || [];

    // Check if PR exists
    const existing = await NPPRequest.findOne({
      type: 'pr-request',
      $or: [
        { uniqueSerialNo: data.uniqueSerialNo || data.prNumber || data.serialNo },
        { rfqNo: data.rfqNo }
      ]
    });
    
    let savedPR;
    
    if (existing) {
      existing.requesterName = data.name || data.requester || existing.requesterName;
      existing.department = data.department || existing.department;
      existing.emailId = data.emailId || data.requesterEmail || existing.emailId;
      existing.contactNo = data.contactNo || existing.contactNo;
      existing.organization = data.organization || existing.organization;
      existing.titleOfActivity = data.titleOfActivity || data.title || existing.titleOfActivity;
      existing.rfqNo = data.rfqNo || existing.rfqNo;
      existing.status = 'Pending';
      existing.stakeholders = approvers;
      existing.attachments = attachments;
      existing.ccList = ccList;
      existing.prItems = (data.items || []).map(item => ({
        costCenter: data.costCenter || 'Purchase Department',
        supplierName: item.supplierName || '',
        rfqNo: data.rfqNo || '',
        partCode: item.partCode || '',
        partDescription: item.partDescription || '',
        specification: item.cndt || item.specification || '',
        cmdt: item.cndt || '',
        uom: item.uom || 'Nos',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        totalValue: item.value || (item.qty || 1) * (item.unitPrice || 0)
      }));
      existing.amount = data.totalValue || 0;
      existing.submittedDate = new Date().toISOString();
      existing.formData = { ...data, approvalChain: approvers, stakeholders: approvers };
      existing.updatedAt = new Date().toISOString();
      
      savedPR = await existing.save();
      console.log('✅ PR submitted:', savedPR.uniqueSerialNo);
    } else {
      const newPR = new NPPRequest({
        type: 'pr-request',
        uniqueSerialNo: data.uniqueSerialNo || data.prNumber || data.serialNo || `PR-${Date.now()}`,
        rfqNo: data.rfqNo || '',
        titleOfActivity: data.titleOfActivity || data.title || 'PR Request',
        requesterName: data.name || data.requester || '',
        emailId: data.emailId || data.requesterEmail || '',
        department: data.department || 'Purchase',
        contactNo: data.contactNo || '',
        organization: data.organization || 'Radiant Appliances',
        status: 'Pending',
        stakeholders: approvers,
        attachments: attachments,
        ccList: ccList,
        prItems: (data.items || []).map(item => ({
          costCenter: data.costCenter || 'Purchase Department',
          supplierName: item.supplierName || '',
          rfqNo: data.rfqNo || '',
          partCode: item.partCode || '',
          partDescription: item.partDescription || '',
          specification: item.cndt || item.specification || '',
          cmdt: item.cndt || '',
          uom: item.uom || 'Nos',
          qty: item.qty || 1,
          unitPrice: item.unitPrice || 0,
          totalValue: item.value || (item.qty || 1) * (item.unitPrice || 0)
        })),
        amount: data.totalValue || 0,
        comparisonId: data.comparisonId || data.rfqId,
        submittedDate: new Date().toISOString(),
        formData: { ...data, approvalChain: approvers, stakeholders: approvers },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      savedPR = await newPR.save();
      console.log('✅ New PR submitted:', savedPR.uniqueSerialNo);
    }
    
    res.json({
      success: true,
      message: 'PR submitted for approval',
      data: savedPR,
      prNumber: savedPR.uniqueSerialNo
    });
    
  } catch (error) {
    console.error('❌ Error submitting PR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit PR',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: GET PR LIST ====================
/**
 * GET /api/pr/list
 * Get all PRs
 */
app.get('/api/pr/list', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const NPPRequest = require('./models/nppRequest.model');
    let PRRequest = null;
    let PrNpp = null;
    try { PRRequest = require('./models/PRRequest'); } catch (e) {}
    try { PrNpp = require('./models/prNpp.model'); } catch (e) {}

    const nppPRs = await NPPRequest.find({ type: 'pr-request' }).sort({ createdAt: -1 });
    let prReqs = [];
    let prNpps = [];
    if (PRRequest) {
      try { prReqs = await PRRequest.find({}).sort({ createdAt: -1 }); } catch (e) {}
    }
    if (PrNpp) {
      try { prNpps = await PrNpp.find({}).sort({ createdAt: -1 }); } catch (e) {}
    }

    const allDocs = [...nppPRs, ...prReqs, ...prNpps];
    const seen = new Set();
    const uniqueDocs = [];
    for (const doc of allDocs) {
      const sNo = String(doc.uniqueSerialNo || doc.prNumber || doc.serialNo || doc._id || '').trim();
      if (sNo && !seen.has(sNo)) {
        seen.add(sNo);
        uniqueDocs.push(doc);
      }
    }

    console.log(`📋 Found ${uniqueDocs.length} unique PRs across models`);

    const formatted = uniqueDocs.map(pr => {
      const fd = pr.formData || {};
      const chain = pr.approvalChain || pr.stakeholders || fd.approvalChain || fd.stakeholders || [];
      const normalizedChain = chain.map((a, i) => ({
        line: a.line || a.lineMode || 'Parallel',
        stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
        comments: a.comments || a.remarks || '',
        designation: a.designation || a.role || '',
        status: a.status || 'Pending',
        dateTime: a.dateTime || a.date || '',
        email: a.email || '',
        contactNo: a.contactNo || '',
        organization: a.organization || ''
      }));

      return {
        id: pr._id,
        prNumber: pr.uniqueSerialNo || pr.prNumber || pr.serialNo || pr._id,
        serialNo: pr.uniqueSerialNo || pr.serialNo || pr.prNumber || pr._id,
        name: pr.requesterName || pr.name || fd.name || '',
        requestDate: pr.requestDate || (pr.createdAt ? String(pr.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]),
        department: pr.department || fd.department || 'Purchase',
        contactNo: pr.contactNo || fd.contactNo || '',
        emailId: pr.emailId || fd.emailId || '',
        organization: pr.organization || fd.organization || 'Radiant Appliances',
        departmentBudget: pr.departmentBudget || fd.departmentBudget || 1500000,
        costCenter: pr.costCenter || fd.costCenter || 'Purchase Department',
        rfqNo: pr.rfqNo || fd.rfqNo || '',
        titleOfActivity: pr.titleOfActivity || fd.titleOfActivity || 'PR Request',
        status: pr.status || 'Pending',
        items: (pr.prItems || pr.items || fd.items || []).map(item => ({
          id: 0,
          rfqNo: item.rfqNo || '',
          supplierName: item.supplierName || '',
          partCode: item.partCode || item.itemCode || '',
          partDescription: item.partDescription || item.description || '',
          cndt: item.cndt || item.specification || '',
          uom: item.uom || 'Nos',
          qty: item.qty || 1,
          currency: 'INR',
          unitPrice: item.unitPrice || 0,
          value: item.totalValue || item.amount || 0
        })),
        totalValue: pr.amount || pr.totalValue || fd.totalValue || 0,
        approvalChain: normalizedChain,
        stakeholders: normalizedChain,
        attachments: pr.attachments || fd.attachments || [],
        ccList: pr.ccList || fd.ccList || [],
        comparisonItems: pr.comparisonItems || fd.comparisonItems || [],
        suppliers: pr.suppliers || fd.suppliers || [],
        termsRows: pr.termsRows || fd.termsRows || [],
        selectedSupplier: pr.selectedSupplier || fd.selectedSupplier || pr.bestSupplier || fd.bestSupplier || '',
        bestSupplier: pr.bestSupplier || fd.bestSupplier || '',
        recommendation: pr.recommendation || fd.recommendation || '',
        submittedDate: pr.submittedDate || pr.requestDate || pr.createdAt,
        approvedBy: pr.approvedBy || '',
        approvedAt: pr.approvedAt || '',
        rejectionReason: pr.rejectionReason || '',
        rejectedBy: pr.rejectedBy || '',
        rejectedAt: pr.rejectedAt || '',
        comparisonId: pr.comparisonId || '',
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt
      };
    });

    res.json({
      success: true,
      data: formatted,
      total: formatted.length
    });

  } catch (error) {
    console.error('❌ Error fetching PRs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PRs',
      error: error.message
    });
  }
});

// Helper to search PR across all 3 Mongoose models (PRRequest, NPPRequest, PrNpp)
const findAnyPR = async (id) => {
  const mongoose = require('mongoose');
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  const isObjectId = mongoose.Types.ObjectId.isValid(cleanId);
  const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const exactRegex = new RegExp('^' + escapeRegex(cleanId) + '$', 'i');
  
  const orConditions = [
    { uniqueSerialNo: cleanId },
    { uniqueSerialNo: exactRegex },
    { prNumber: cleanId },
    { prNumber: exactRegex },
    { serialNo: cleanId },
    { serialNo: exactRegex },
    { requestId: cleanId },
    { requestId: exactRegex },
    { rfqNo: cleanId },
    { rfqNo: exactRegex }
  ];
  if (isObjectId) {
    orConditions.unshift({ _id: cleanId });
  }

  const models = [];
  try { models.push(require('./models/PRRequest')); } catch (e) {}
  try { models.push(require('./models/nppRequest.model')); } catch (e) {}
  try { models.push(require('./models/prNpp.model')); } catch (e) {}

  for (const model of models) {
    try {
      let doc = await model.findOne({ $or: orConditions });
      if (doc) return doc;
    } catch (err) {}
  }

  // Fallback: search by regex contains
  for (const model of models) {
    try {
      let doc = await model.findOne({
        $or: [
          { uniqueSerialNo: { $regex: escapeRegex(cleanId), $options: 'i' } },
          { prNumber: { $regex: escapeRegex(cleanId), $options: 'i' } },
          { serialNo: { $regex: escapeRegex(cleanId), $options: 'i' } }
        ]
      });
      if (doc) return doc;
    } catch (err) {}
  }

  return null;
};

// ==================== ✅ GET SINGLE PR ====================
/**
 * GET /api/pr/:id
 * Get a single PR by ID or serial number
 */
app.get('/api/pr/:id', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let pr = await findAnyPR(id);
    
    if (!pr) {
      return res.status(404).json({
        success: false,
        message: 'PR not found'
      });
    }

    const fd = pr.formData || {};
    const chain = pr.approvalChain || pr.stakeholders || fd.approvalChain || fd.stakeholders || [];
    const normalizedChain = chain.map((a, i) => ({
      line: a.line || a.lineMode || 'Parallel',
      stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
      comments: a.comments || a.remarks || '',
      designation: a.designation || a.role || '',
      status: a.status || 'Pending',
      dateTime: a.dateTime || a.date || '',
      email: a.email || '',
      contactNo: a.contactNo || '',
      organization: a.organization || ''
    }));
    
    res.json({
      success: true,
      data: {
        id: pr._id,
        prNumber: pr.uniqueSerialNo || pr.prNumber || pr._id,
        serialNo: pr.uniqueSerialNo || pr.serialNo || pr._id,
        name: pr.requesterName || pr.name || fd.name || '',
        requestDate: pr.requestDate || (pr.createdAt ? String(pr.createdAt).split('T')[0] : ''),
        department: pr.department || fd.department || 'Purchase',
        contactNo: pr.contactNo || fd.contactNo || '',
        emailId: pr.emailId || fd.emailId || '',
        organization: pr.organization || fd.organization || 'Radiant Appliances',
        departmentBudget: pr.departmentBudget || fd.departmentBudget || 1500000,
        costCenter: pr.costCenter || fd.costCenter || 'Purchase Department',
        rfqNo: pr.rfqNo || fd.rfqNo || '',
        titleOfActivity: pr.titleOfActivity || fd.titleOfActivity || 'PR Request',
        status: pr.status || 'Pending',
        items: (pr.prItems || pr.items || fd.items || []).map(item => ({
          id: 0,
          rfqNo: item.rfqNo || '',
          supplierName: item.supplierName || '',
          partCode: item.partCode || item.itemCode || '',
          partDescription: item.partDescription || item.description || '',
          cndt: item.cndt || item.specification || '',
          uom: item.uom || 'Nos',
          qty: item.qty || 1,
          currency: 'INR',
          unitPrice: item.unitPrice || 0,
          value: item.totalValue || item.amount || 0
        })),
        totalValue: pr.amount || pr.totalValue || fd.totalValue || 0,
        approvalChain: normalizedChain,
        stakeholders: normalizedChain,
        attachments: pr.attachments || fd.attachments || [],
        ccList: pr.ccList || fd.ccList || [],
        comparisonItems: pr.comparisonItems || fd.comparisonItems || [],
        suppliers: pr.suppliers || fd.suppliers || [],
        termsRows: pr.termsRows || fd.termsRows || [],
        selectedSupplier: pr.selectedSupplier || fd.selectedSupplier || pr.bestSupplier || fd.bestSupplier || '',
        bestSupplier: pr.bestSupplier || fd.bestSupplier || '',
        recommendation: pr.recommendation || fd.recommendation || '',
        submittedDate: pr.submittedDate || pr.requestDate,
        approvedBy: pr.approvedBy || '',
        approvedAt: pr.approvedAt || '',
        rejectionReason: pr.rejectionReason || '',
        rejectedBy: pr.rejectedBy || '',
        rejectedAt: pr.rejectedAt || '',
        comparisonId: pr.comparisonId || '',
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching PR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PR',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: APPROVE PR (Multi-level Chain + Auto-PO) ====================
/**
 * POST /api/pr/:id/approve
 * Approve a PR
 */
app.post('/api/pr/:id/approve', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Approver';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const userRole = (req.user?.role || req.user?.designation || '').toLowerCase().trim();

    let pr = await findAnyPR(id);

    if (!pr) {
      return res.status(404).json({ success: false, message: 'PR not found' });
    }

    const fd = pr.formData || {};
    let approvers = pr.approvalChain || pr.stakeholders || fd.approvalChain || fd.stakeholders || [];
    
    // Normalize into standard structure
    approvers = approvers.map((a, i) => ({
      line: a.line || a.lineMode || 'Parallel',
      stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
      managerName: a.managerName || a.stakeholder || a.name || `Approver ${i+1}`,
      comments: a.comments || a.remarks || '',
      remarks: a.remarks || a.comments || '',
      designation: a.designation || a.role || '',
      status: a.status || 'Pending',
      dateTime: a.dateTime || a.date || '',
      email: a.email || '',
      contactNo: a.contactNo || '',
      organization: a.organization || ''
    }));

    if (!approvers.length) {
      approvers.push({
        line: 'Parallel',
        stakeholder: userName,
        managerName: userName,
        email: userEmail,
        designation: req.user?.designation || req.user?.role || 'Approver',
        status: 'Pending',
        comments: '',
        remarks: ''
      });
    }

    // Match the current approver
    let target = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase())
    );

    // Fallback: If senior role (Admin/Purchase Head/Engineer/Manager/VP), act on first pending approver
    if (!target || target.status === 'Approved' || target.status === 'approved') {
      const isSenior = ['admin', 'purchase head', 'head - purchase', 'vp', 'vp-operation', 'engineer', 'manager'].some(r => userRole.includes(r));
      if (isSenior) {
        target = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
      }
    }

    const nowFormatted = new Date().toLocaleString('en-US', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    if (target) {
      target.status = 'Approved';
      target.dateTime = nowFormatted;
      target.remarks = comments || target.remarks || 'Approved';
      target.comments = comments || target.comments || 'Approved';
      target.approvedBy = userName;
    }

    // Check if any approvers in chain are still pending
    const remainingPending = approvers.filter(s => (s.status || 'Pending').toLowerCase() === 'pending');

    if (remainingPending.length === 0) {
      pr.status = 'Approved';
      pr.approvedAt = new Date().toISOString();
      pr.approvedBy = userName;
      if (comments) pr.approvalComments = comments;

      // Auto-create PO in PoNpp and NPPRequest
      await autoCreatePOFromApprovedPR(pr);
    } else {
      pr.status = 'Pending';
    }

    pr.stakeholders = approvers;
    pr.approvalChain = approvers;
    if (pr.formData) {
      pr.formData.approvalChain = approvers;
      pr.formData.stakeholders = approvers;
      pr.formData.status = pr.status;
      if (pr.markModified) pr.markModified('formData');
    }
    pr.updatedAt = new Date().toISOString();
    await pr.save();

    console.log(`✅ PR approved by ${userName} (${userEmail}). Overall Status: ${pr.status}, Pending count: ${remainingPending.length}`);

    return res.json({
      success: true,
      message: remainingPending.length === 0 ? 'PR fully Approved and moved to PO stage!' : `Approved by ${userName}. Remaining pending approvers: ${remainingPending.length}`,
      data: pr
    });

  } catch (error) {
    console.error('❌ Error approving PR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve PR',
      error: error.message
    });
  }
});

// ==================== ✅ NEW: REJECT PR ====================
/**
 * POST /api/pr/:id/reject
 * Reject a PR
 */
app.post('/api/pr/:id/reject', authMiddleware, moduleAccessMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Rejecter';
    const userEmail = (req.user?.email || '').toLowerCase().trim();

    let pr = await findAnyPR(id);

    if (!pr) {
      return res.status(404).json({ success: false, message: 'PR not found' });
    }

    const fd = pr.formData || {};
    let approvers = pr.approvalChain || pr.stakeholders || fd.approvalChain || fd.stakeholders || [];
    
    approvers = approvers.map((a, i) => ({
      line: a.line || a.lineMode || 'Parallel',
      stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
      managerName: a.managerName || a.stakeholder || a.name || `Approver ${i+1}`,
      comments: a.comments || a.remarks || '',
      remarks: a.remarks || a.comments || '',
      designation: a.designation || a.role || '',
      status: a.status || 'Pending',
      dateTime: a.dateTime || a.date || '',
      email: a.email || '',
      contactNo: a.contactNo || '',
      organization: a.organization || ''
    }));

    let target = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase())
    );

    if (!target) {
      target = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
    }

    const nowFormatted = new Date().toLocaleString('en-US', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    if (target) {
      target.status = 'Rejected';
      target.dateTime = nowFormatted;
      target.remarks = comments || 'Rejected';
      target.comments = comments || 'Rejected';
      target.rejectedBy = userName;
    }

    pr.status = 'Rejected';
    pr.rejectionReason = comments || 'Rejected';
    pr.rejectedAt = new Date().toISOString();
    pr.rejectedBy = userName;
    pr.stakeholders = approvers;
    pr.approvalChain = approvers;
    if (pr.formData) {
      pr.formData.approvalChain = approvers;
      pr.formData.stakeholders = approvers;
      pr.formData.status = 'Rejected';
      if (pr.markModified) pr.markModified('formData');
    }
    pr.updatedAt = new Date().toISOString();
    await pr.save();

    console.log(`❌ PR rejected by ${userName} (${userEmail}).`);

    return res.json({
      success: true,
      message: 'PR rejected successfully',
      data: pr
    });

  } catch (error) {
    console.error('❌ Error rejecting PR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject PR',
      error: error.message
    });
  }
});

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
      },
      vendorRequest: {
        create: "POST /api/vendor-request",
        getAll: "GET /api/vendor-request",
        getByRfq: "GET /api/vendor-request/rfq/:rfqId",
        getById: "GET /api/vendor-request/:id",
        update: "PATCH /api/vendor-request/:id",
        delete: "DELETE /api/vendor-request/:id"
      },
      quotation: {
        create: "POST /api/quotation",
        getByRfq: "GET /api/quotation/rfq/:rfqId",
        comparison: "GET /api/quotation/comparison/:rfqId",
        latestComparison: "GET /api/quotation/latest/comparison",
        updateStatus: "PATCH /api/quotation/:id/status",
        selectWinner: "POST /api/quotation/:rfqId/winner"
      },
      quotationComparison: {
        submit: "POST /api/quotation-comparison/submit",
        list: "GET /api/quotation-comparison/list",
        submitted: "GET /api/quotation-comparison/submitted"
      },
      pr: {
        list: "GET /api/pr/list",
        save: "POST /api/pr/save",
        submit: "POST /api/pr/submit",
        createFromComparison: "POST /api/pr/create-from-comparison",
        getById: "GET /api/pr/:id",
        approve: "POST /api/pr/:id/approve",
        reject: "POST /api/pr/:id/reject"
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
        pass: process.env.SMTP_PASS || 'jzix seng gfwe pyvm'  // Your NEW app password WITH spaces
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

// ✅ Wait for MongoDB connection before starting server
const startServer = async () => {
  try {
    // Wait for database connection
    await mongoose.connection.asPromise();
    console.log('✅ MongoDB connected successfully!');
    
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
      console.log(`✅ Vendor Request: POST /api/vendor-request`);
      console.log(`✅ Quotation: POST /api/quotation`);
      console.log(`✅ Latest Comparison: GET /api/pr/latest/comparison`);
      console.log(`\n🆕 NEW ENDPOINTS ADDED:`);
      console.log(`   POST /api/quotation-comparison/submit`);
      console.log(`   GET  /api/quotation-comparison/list`);
      console.log(`   GET  /api/quotation-comparison/submitted`);
      console.log(`   POST /api/pr/save`);
      console.log(`   POST /api/pr/submit`);
      console.log(`   POST /api/pr/create-from-comparison`);
      console.log(`   GET  /api/pr/list`);
      console.log(`   GET  /api/pr/:id`);
      console.log(`   POST /api/pr/:id/approve`);
      console.log(`   POST /api/pr/:id/reject`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.log('⚠️ API server kept alive. Check Atlas network access/DNS or MONGO_URI, then restart when fixed.');
  }
};

// Start the server
startServer();

module.exports = app;