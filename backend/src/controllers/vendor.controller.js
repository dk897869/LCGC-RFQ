const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Vendor = require("../models/vendor");
const User = require("../models/user.model");
const NPPRequest = require("../models/nppRequest.model");

const isAdminUser = (user = {}) => ['Admin', 'Manager', 'Senior Manager'].includes(user.role);
const makeTempPassword = () => `Vendor@${Math.floor(100000 + Math.random() * 900000)}`;

// GET All Vendors
exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: vendors,
      count: vendors.length 
    });
  } catch (err) {
    console.error("Get Vendors Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// GET Single Vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format." 
      });
    }
    
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: "Vendor not found" 
      });
    }
    res.json({ success: true, data: vendor });
  } catch (err) {
    console.error("Get Vendor By ID Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// CREATE Vendor
exports.addVendor = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: "Vendor name is required" 
      });
    }
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number is required" 
      });
    }
    
    const existingVendor = await Vendor.findOne({ email: email.toLowerCase() });
    if (existingVendor) {
      return res.status(400).json({ 
        success: false, 
        message: "Vendor with this email already exists" 
      });
    }
    
    const vendorData = {
      ...req.body,
      email: email.toLowerCase(),
      status: req.body.status || "Active",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const vendor = await Vendor.create(vendorData);
    res.status(201).json({ 
      success: true, 
      message: "Vendor added successfully", 
      data: vendor 
    });
  } catch (err) {
    console.error("Add Vendor Error:", err);
    
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(", ") 
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// UPDATE Vendor
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format." 
      });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const vendor = await Vendor.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: "Vendor not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Vendor updated successfully", 
      data: vendor 
    });
  } catch (err) {
    console.error("Update Vendor Error:", err);
    
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(", ") 
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Update Vendor Status
exports.updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format" 
      });
    }
    
    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { 
        status, 
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: "Vendor not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Vendor status updated successfully", 
      data: vendor 
    });
  } catch (err) {
    console.error("Update Vendor Status Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// DELETE Vendor
exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format." 
      });
    }
    
    const vendor = await Vendor.findByIdAndDelete(id);
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: "Vendor not found" 
      });
    }
    res.json({ 
      success: true, 
      message: "Vendor deleted successfully" 
    });
  } catch (err) {
    console.error("Delete Vendor Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// ==================== SEARCH METHODS ====================

// Search Vendors - supports both 'query' and 'search' parameter
exports.searchVendors = async (req, res) => {
  try {
    const { query, search } = req.query;
    const searchTerm = query || search;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }
    
    console.log('🔍 Searching vendors with term:', searchTerm);
    
    let vendors = await Vendor.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { company: { $regex: searchTerm, $options: "i" } },
        { gst: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } }
      ]
    }).sort({ name: 1 });
    
    const users = await User.find({
      role: 'Vendor',
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { contactNo: { $regex: searchTerm, $options: "i" } }
      ]
    }).select('name email contactNo organization');
    
    const userVendors = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.contactNo || '',
      company: u.organization || '',
      vendorName: u.name,
      vendorEmail: u.email,
      isUser: true
    }));
    
    const allVendors = [...vendors, ...userVendors];
    const uniqueVendors = allVendors.filter((v, index, self) => 
      index === self.findIndex(t => t.email?.toLowerCase() === v.email?.toLowerCase())
    );
    
    res.json({
      success: true,
      data: uniqueVendors,
      count: uniqueVendors.length
    });
  } catch (err) {
    console.error("Search Vendors Error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Find vendor by email - for auto-fetch in RFQ vendor form
exports.findVendorByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required"
      });
    }

    console.log('🔍 Searching vendor by email:', email);

    let vendor = await Vendor.findOne({ 
      email: { $regex: `^${email.trim()}$`, $options: 'i' } 
    });

    if (!vendor) {
      const user = await User.findOne({ 
        email: { $regex: `^${email.trim()}$`, $options: 'i' },
        role: 'Vendor'
      }).select('name email contactNo organization');
      
      if (user) {
        return res.json({
          success: true,
          data: [{
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.contactNo,
            company: user.organization,
            vendorName: user.name,
            vendorEmail: user.email
          }]
        });
      }
    }

    if (!vendor) {
      return res.json({
        success: true,
        data: [],
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      data: [{
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        company: vendor.company || vendor.organization,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        gst: vendor.gst,
        address: vendor.address,
        vendorId: vendor._id
      }]
    });

  } catch (err) {
    console.error("Find Vendor By Email Error:", err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to find vendor'
    });
  }
};

// Get Vendor Statistics
exports.getVendorStats = async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ status: "Active" });
    const inactiveVendors = await Vendor.countDocuments({ status: "Inactive" });
    
    const vendorsByCompany = await Vendor.aggregate([
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        total: totalVendors,
        active: activeVendors,
        inactive: inactiveVendors,
        topCompanies: vendorsByCompany
      }
    });
  } catch (err) {
    console.error("Get Vendor Stats Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// CREATE temporary vendor login
exports.createTemporaryVendorAccount = async (req, res) => {
  try {
    console.log('📤 Creating temporary vendor account');

    if (!isAdminUser(req.user)) {
      return res.status(403).json({ 
        success: false, 
        message: "Only admin/manager can create vendor login" 
      });
    }

    const { name, email, phone, company, gst, rfqNos = [], expiresAt, password } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Vendor name and email are required" 
      });
    }

    let vendor = await Vendor.findOne({ email: String(email).toLowerCase() });
    
    if (!vendor) {
      vendor = await Vendor.create({
        name,
        email: String(email).toLowerCase(),
        phone: phone || '',
        company: company || name,
        gst: gst || '',
        status: 'Active'
      });
    }

    const tempPassword = password || makeTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const accountData = {
      name,
      email: String(email).toLowerCase(),
      password: hashedPassword,
      role: 'Vendor',
      contactNo: phone || '',
      department: 'Vendor',
      designation: 'Temporary Vendor',
      organization: company || vendor.company || name,
      isActive: true,
      emailVerified: true,
      rights: { nppProcurement: true, vendors: true, rfq: true },
      vendorAccount: {
        isTemporary: true,
        vendorId: vendor._id,
        rfqNos: Array.isArray(rfqNos) ? rfqNos.filter(Boolean) : String(rfqNos || '').split(',').map(v => v.trim()).filter(Boolean),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        deactivatedAt: undefined,
        deactivatedReason: ''
      }
    };

    let user = await User.findOne({ email: accountData.email });
    
    if (user) {
      Object.assign(user, accountData);
      await user.save();
    } else {
      user = await User.create(accountData);
    }

    // Send welcome email (non-blocking)
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || 'dk897869@gmail.com',
          pass: process.env.SMTP_PASS || 'snaq ptsl yqpm hufr'
        }
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      
      await transporter.sendMail({
        from: `"LCGC RFQ System" <${process.env.SMTP_USER || 'dk897869@gmail.com'}>`,
        to: email,
        subject: 'Vendor Account Created - LCGC Portal',
        html: `
          <h2>Welcome to LCGC Vendor Portal</h2>
          <p>Dear ${name || 'Vendor'},</p>
          <p>Your vendor account has been created successfully.</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><a href="${frontendUrl}/login">Login Here</a></p>
          <p>Please change your password after first login.</p>
        `
      });
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailErr) {
      console.error('⚠️ Welcome email error (non-blocking):', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Temporary vendor login created",
      data: {
        vendor,
        account: {
          id: user._id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          expiresAt: user.vendorAccount?.expiresAt,
          rfqNos: user.vendorAccount?.rfqNos || []
        },
        temporaryPassword: tempPassword
      }
    });
  } catch (err) {
    console.error("Create Temporary Vendor Account Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.deactivateTemporaryVendorAccount = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ 
        success: false, 
        message: "Only admin/manager can deactivate vendor login" 
      });
    }
    const { id } = req.params;
    const { reason = 'Work completed' } = req.body || {};
    const user = await User.findByIdAndUpdate(
      id,
      {
        isActive: false,
        'vendorAccount.deactivatedAt': new Date(),
        'vendorAccount.deactivatedReason': reason
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "Vendor account not found" 
      });
    }
    res.json({ 
      success: true, 
      message: "Vendor login deactivated", 
      data: user 
    });
  } catch (err) {
    console.error("Deactivate Vendor Account Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.getMyVendorRfqs = async (req, res) => {
  try {
    const isVendor = req.user?.role === 'Vendor';
    const isAdminPreview = isAdminUser(req.user);
    
    if (!isVendor && !isAdminPreview) {
      return res.status(403).json({ 
        success: false, 
        message: "Vendor login required" 
      });
    }
    
    if (!isVendor && isAdminPreview) {
      const requests = await NPPRequest.find({
        type: { $in: ['rfq-vendor', 'rfq-requisition', 'quotation-submission', 'rfq'] }
      }).sort({ createdAt: -1 }).limit(100);
      return res.json({ 
        success: true, 
        count: requests.length, 
        data: requests, 
        preview: true 
      });
    }
    
    if (req.user?.vendorAccount?.expiresAt && new Date(req.user.vendorAccount.expiresAt) < new Date()) {
      await User.findByIdAndUpdate(req.user.id || req.user._id, {
        isActive: false,
        'vendorAccount.deactivatedAt': new Date(),
        'vendorAccount.deactivatedReason': 'Temporary access expired'
      });
      return res.status(403).json({ 
        success: false, 
        message: "Vendor access expired" 
      });
    }

    const email = String(req.user.email || '').toLowerCase();
    const rfqNos = req.user.vendorAccount?.rfqNos || [];
    const query = {
      type: { $in: ['rfq-vendor', 'rfq-requisition', 'quotation-submission'] },
      $or: [
        { vendorEmail: email },
        { 'vendorDetails.email': email },
        { 'vendorList.emailId': email },
        { rfqNo: { $in: rfqNos } },
        { 'rfqVendorItems.rfqNo': { $in: rfqNos } }
      ]
    };
    const requests = await NPPRequest.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ 
      success: true, 
      count: requests.length, 
      data: requests 
    });
  } catch (err) {
    console.error("Vendor RFQ Dashboard Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};