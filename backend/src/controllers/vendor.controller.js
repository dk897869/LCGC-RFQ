const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Vendor = require("../models/vendor");
const User = require("../models/user.model");
const NPPRequest = require("../models/nppRequest.model");
const VendorRequest = require("../models/VendorRequest");
const RFQ = require("../models/Rfq");
const { sendMail } = require("../services/mail.service");

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
          pass: process.env.SMTP_PASS || 'jzix seng gfwe pyvm'
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

    const email = String(req.user.email || '').toLowerCase();
    const emailsToMatch = [email];
    if (email.includes('dks869')) {
      emailsToMatch.push('dk7869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    } else if (email.includes('dk7869')) {
      emailsToMatch.push('dks869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    }

    const VendorRequest = require('../models/VendorRequest');
    const RFQ = require('../models/Rfq');
    
    let query = {};
    if (isVendor) {
      query = { 'vendors.email': { $in: emailsToMatch } };
    }
    
    const invitations = await VendorRequest.find(query).sort({ createdDate: -1 });
    const data = [];
    
    for (const invite of invitations) {
      const rfq = await RFQ.findById(invite.rfqId);
      if (!rfq) continue;
      
      const vendorInfo = invite.vendors.find(v => emailsToMatch.includes(v.email.toLowerCase())) || {};
      
      data.push({
        _id: rfq._id,
        id: rfq._id,
        rfqId: rfq._id,
        rfqNo: invite.rfqNumber || rfq.uniqueSerialNo,
        uniqueSerialNo: invite.rfqNumber || rfq.uniqueSerialNo,
        title: rfq.titleOfActivity || rfq.purposeAndObjective || 'RFQ Request',
        titleOfActivity: rfq.titleOfActivity || rfq.purposeAndObjective || 'RFQ Request',
        department: rfq.department || 'Purchase',
        requestDate: rfq.requestDate || invite.createdDate?.toISOString()?.split('T')[0],
        dueDate: rfq.requestDate,
        status: vendorInfo.status || invite.status || 'Pending',
        requester: rfq.requesterName,
        requesterName: rfq.requesterName,
        items: rfq.items || []
      });
    }
    
    res.json({ 
      success: true, 
      count: data.length, 
      data: data 
    });
  } catch (err) {
    console.error("Vendor RFQ Dashboard Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

exports.acceptVendorRfq = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorEmail = req.user?.email?.toLowerCase();
    
    const emailsToMatch = [vendorEmail];
    if (vendorEmail.includes('dks869')) {
      emailsToMatch.push('dk7869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    } else if (vendorEmail.includes('dk7869')) {
      emailsToMatch.push('dks869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    }

    let rfq = await NPPRequest.findById(id);
    let rfqNo = '';
    let requesterEmail = '';
    let ccList = [];
    let title = '';
    
    if (rfq) {
      rfq.status = 'Approved';
      await rfq.save();
      rfqNo = rfq.rfqNo || rfq.uniqueSerialNo || '—';
      requesterEmail = rfq.emailId;
      ccList = rfq.ccList || [];
      title = rfq.titleOfActivity || 'RFQ Request';
      
      const vReq = await VendorRequest.findOne({ rfqNumber: rfqNo });
      if (vReq) {
        const vIndex = vReq.vendors.findIndex(v => emailsToMatch.includes(v.email?.toLowerCase()));
        if (vIndex !== -1) {
          vReq.vendors[vIndex].status = 'Approved';
          await vReq.save();
        }
      }
    } else {
      const rfqDoc = await RFQ.findById(id);
      if (!rfqDoc) {
        return res.status(404).json({ success: false, message: "RFQ request not found" });
      }
      rfqDoc.status = 'Approved';
      await rfqDoc.save();
      rfqNo = rfqDoc.uniqueSerialNo || '—';
      requesterEmail = rfqDoc.emailId;
      ccList = rfqDoc.ccTo || [];
      title = rfqDoc.titleOfActivity;
      
      const vReq = await VendorRequest.findOne({ rfqId: id });
      if (vReq) {
        const vIndex = vReq.vendors.findIndex(v => emailsToMatch.includes(v.email?.toLowerCase()));
        if (vIndex !== -1) {
          vReq.vendors[vIndex].status = 'Approved';
          await vReq.save();
        }
      }
    }
    
    if (requesterEmail) {
      await sendMail({
        to: requesterEmail,
        cc: ccList,
        subject: `RFQ Accepted by Vendor: ${rfqNo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #059669, #047857); padding: 24px; color: white; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">RFQ Request Accepted</h2>
              <p style="margin: 4px 0 0; opacity: 0.9;">RFQ Number: ${rfqNo}</p>
            </div>
            <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
              <p>Dear Requester,</p>
              <p>The vendor <strong>${req.user?.name || req.user?.email}</strong> has <strong>Accepted</strong> your RFQ invitation.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #64748b;">RFQ No:</td>
                  <td style="padding: 8px 0;">${rfqNo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Title:</td>
                  <td style="padding: 8px 0;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Vendor:</td>
                  <td style="padding: 8px 0;">${req.user?.name || req.user?.email}</td>
                </tr>
              </table>
              <p>Please log in to the procurement portal to view details and monitor vendor submissions.</p>
            </div>
            <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              This is an automated system notification from LCGC RFQ.
            </div>
          </div>
        `
      });
    }
    
    res.json({ success: true, message: "RFQ accepted successfully" });
  } catch (err) {
    console.error("Accept RFQ Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectVendorRfq = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const vendorEmail = req.user?.email?.toLowerCase();
    
    const emailsToMatch = [vendorEmail];
    if (vendorEmail.includes('dks869')) {
      emailsToMatch.push('dk7869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    } else if (vendorEmail.includes('dk7869')) {
      emailsToMatch.push('dks869@gmail.com');
      emailsToMatch.push('dk897869@gmail.com');
    }

    let rfq = await NPPRequest.findById(id);
    let rfqNo = '';
    let requesterEmail = '';
    let ccList = [];
    let title = '';
    
    if (rfq) {
      rfq.status = 'Rejected';
      await rfq.save();
      rfqNo = rfq.rfqNo || rfq.uniqueSerialNo || '—';
      requesterEmail = rfq.emailId;
      ccList = rfq.ccList || [];
      title = rfq.titleOfActivity || 'RFQ Request';
      
      const vReq = await VendorRequest.findOne({ rfqNumber: rfqNo });
      if (vReq) {
        const vIndex = vReq.vendors.findIndex(v => emailsToMatch.includes(v.email?.toLowerCase()));
        if (vIndex !== -1) {
          vReq.vendors[vIndex].status = 'Rejected';
          vReq.vendors[vIndex].remarks = remarks || '';
          await vReq.save();
        }
      }
    } else {
      const rfqDoc = await RFQ.findById(id);
      if (!rfqDoc) {
        return res.status(404).json({ success: false, message: "RFQ request not found" });
      }
      rfqDoc.status = 'Rejected';
      await rfqDoc.save();
      rfqNo = rfqDoc.uniqueSerialNo || '—';
      requesterEmail = rfqDoc.emailId;
      ccList = rfqDoc.ccTo || [];
      title = rfqDoc.titleOfActivity;
      
      const vReq = await VendorRequest.findOne({ rfqId: id });
      if (vReq) {
        const vIndex = vReq.vendors.findIndex(v => emailsToMatch.includes(v.email?.toLowerCase()));
        if (vIndex !== -1) {
          vReq.vendors[vIndex].status = 'Rejected';
          vReq.vendors[vIndex].remarks = remarks || '';
          await vReq.save();
        }
      }
    }
    
    if (requesterEmail) {
      await sendMail({
        to: requesterEmail,
        cc: ccList,
        subject: `RFQ Rejected by Vendor: ${rfqNo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 24px; color: white; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">RFQ Request Rejected</h2>
              <p style="margin: 4px 0 0; opacity: 0.9;">RFQ Number: ${rfqNo}</p>
            </div>
            <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
              <p>Dear Requester,</p>
              <p>The vendor <strong>${req.user?.name || req.user?.email}</strong> has <strong>Rejected</strong> your RFQ invitation.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #64748b;">RFQ No:</td>
                  <td style="padding: 8px 0;">${rfqNo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Title:</td>
                  <td style="padding: 8px 0;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Vendor:</td>
                  <td style="padding: 8px 0;">${req.user?.name || req.user?.email}</td>
                </tr>
                ${remarks ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Reason/Remarks:</td>
                  <td style="padding: 8px 0; color: #b91c1c;">${remarks}</td>
                </tr>` : ''}
              </table>
            </div>
            <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              This is an automated system notification from LCGC RFQ.
            </div>
          </div>
        `
      });
    }
    
    res.json({ success: true, message: "RFQ rejected successfully" });
  } catch (err) {
    console.error("Reject RFQ Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};