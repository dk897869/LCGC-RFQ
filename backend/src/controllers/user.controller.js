const mongoose = require("mongoose");
const User = require("../models/user.model");
const { sendMail } = require("../services/mail.service");

const MODULE_ID_TO_RIGHT = {
  'ep-approval': 'epApproval',
  vendors: 'vendors',
  parts: 'parts',
  rfq: 'rfq',
  'npp-procurement': 'nppProcurement',
  'po-npp': 'nppProcurement',
  wcc: 'nppProcurement',
  'rfq-request': 'nppProcurement',
  'pr-process': 'nppProcurement',
  'material-management': 'nppProcurement',
  reports: 'nppProcurement',
  'scrap-material-bidding': 'bidding',
  'item-master-list': 'nppProcurement',
  'vendor-details': 'nppProcurement',
  'approval-status': 'nppProcurement',
  bidding: 'bidding',
  'payment-request': 'paymentRequest',
  dqms: 'dqms',
  npi: 'npi',
  'system-bom': 'systemBom',
  'bom-forecast': 'bomForecast',
  'price-approval': 'priceApproval',
  'plan-stock': 'planStock',
  'supplier-performance': 'supplierPerformance',
  'vehicular-ms': 'vehicularMs',
  'user-management': 'userManagement'
};

const canReviewAccessRequests = (user) => ['Admin', 'Manager'].includes(user?.role);

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    // Only Admin can view all users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }
    
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Users can only view their own profile unless admin
    if (req.user.role !== 'Admin' && String(req.user._id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new user (Admin only)
exports.createUser = async (req, res) => {
  try {
    console.log("📤 Creating user with data:", req.body);
    
    // Only Admin can create users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }
    
    const { name, email, password, role, department, contactNo, organization, rights } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email and password are required" 
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "User with this email already exists" 
      });
    }
    
    // Create user with rights
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: password,
      role: role || 'User',
      department: department || '',
      contactNo: contactNo || '',
      organization: organization || 'Radiant Appliances',
      rights: {
        epApproval: rights?.epApproval || false,
        vendors: rights?.vendors || false,
        parts: rights?.parts || false,
        rfq: rights?.rfq || false,
        userManagement: rights?.userManagement || false,
        nppProcurement: rights?.nppProcurement || false,
        bidding: rights?.bidding || false,
        paymentRequest: rights?.paymentRequest || false,
        dqms: rights?.dqms || false,
        npi: rights?.npi || false,
        systemBom: rights?.systemBom || false,
        bomForecast: rights?.bomForecast || false,
        priceApproval: rights?.priceApproval || false,
        planStock: rights?.planStock || false,
        supplierPerformance: rights?.supplierPerformance || false,
        vehicularMs: rights?.vehicularMs || false
      }
    });
    
    await user.save();
    
    console.log("✅ User created:", user._id);
    
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        rights: user.rights
      }
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Check permissions
    if (req.user.role !== 'Admin' && String(req.user._id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    const { name, email, role, department, contactNo, organization, dateOfBirth, workspaces, profileImage } = req.body;
    
    // Update fields
    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase();
    if (role && req.user.role === 'Admin') user.role = role;
    if (department !== undefined) user.department = department;
    if (contactNo !== undefined) user.contactNo = contactNo;
    if (organization !== undefined) user.organization = organization;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (workspaces !== undefined) user.workspaces = Array.isArray(workspaces) ? workspaces : [];
    if (profileImage !== undefined) user.profileImage = profileImage;
    
    // Update password if provided
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        rights: user.rights
      }
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user rights (Admin only)
exports.updateUserRights = async (req, res) => {
  try {
    const { id } = req.params;
    const { rights } = req.body;
    
    console.log("📤 Updating user rights for:", id);
    console.log("Rights data:", rights);
    
    // Only Admin can update rights
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Update rights
    if (rights) {
      user.rights = {
        ...user.rights,
        ...rights
      };
      user.fullModuleAccessGranted = false;
    }
    
    await user.save();
    
    console.log("✅ User rights updated for:", user.email);
    
    res.json({
      success: true,
      message: "User rights updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rights: user.rights
      }
    });
  } catch (error) {
    console.error("Update user rights error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only Admin can delete users
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate new password for user/vendor (Admin only)
exports.generateUserPassword = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Access denied. Admin only." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let newPassword = '';
    for (let i = 0; i < 10; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    user.password = newPassword;
    await user.save();

    await sendMail({
      to: user.email,
      subject: 'Your New LCGC RFQ Password',
      html: `<p>Hello ${user.name},</p><p>Your password has been reset by an administrator.</p><p><strong>New Password:</strong> ${newPassword}</p><p>Please log in and change your password immediately.</p>`,
      text: `Your new LCGC RFQ password is: ${newPassword}`
    });

    res.json({
      success: true,
      message: "New password generated and emailed",
      data: { id: user._id, email: user.email, password: newPassword }
    });
  } catch (error) {
    console.error("Generate password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.requestModuleAccess = async (req, res) => {
  try {
    const requesterId = req.user.id || req.user._id;
    const requester = await User.findById(requesterId).select('-password');
    if (!requester) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (requester.role !== 'User') {
      return res.status(400).json({ success: false, message: "Only User role accounts need to request module access" });
    }

    if (requester.fullModuleAccessGranted) {
      return res.json({ success: true, message: "Access already granted", data: requester });
    }

    const moduleId = String(req.body.moduleId || '').trim();
    const moduleName = String(req.body.moduleName || '').trim();

    requester.accessRequest = {
      status: 'pending',
      message: req.body.message || '',
      moduleId,
      moduleName,
      requestedAt: new Date()
    };
    await requester.save();

    const reviewers = await User.find({ role: { $in: ['Admin', 'Manager'] }, isActive: true }).select('email name');
    const reviewerEmails = reviewers.map((u) => u.email).filter(Boolean);
    if (reviewerEmails.length) {
      await sendMail({
        to: reviewerEmails[0],
        cc: reviewerEmails.slice(1),
        subject: `Module Access Request - ${requester.name}`,
        html: `
          <h2>Module Access Request</h2>
          <p><strong>Name:</strong> ${requester.name}</p>
          <p><strong>Email:</strong> ${requester.email}</p>
          <p><strong>Department:</strong> ${requester.department || '-'}</p>
          <p><strong>Requested Module:</strong> ${requester.accessRequest.moduleName || requester.accessRequest.moduleId || 'Module Access'}</p>
          <p><strong>Message:</strong> ${requester.accessRequest.message || '-'}</p>
        `,
        text: `Module access request from ${requester.name} (${requester.email})`
      });
    }

    res.json({
      success: true,
      message: "Access request sent to admin/manager",
      data: {
        id: requester._id,
        name: requester.name,
        email: requester.email,
        accessRequest: requester.accessRequest
      }
    });
  } catch (error) {
    console.error("Request module access error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getModuleAccessRequests = async (req, res) => {
  try {
    if (!canReviewAccessRequests(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied. Admin or Manager only." });
    }

    const status = req.query.status || 'pending';
    const users = await User.find({ 'accessRequest.status': status })
      .select('-password')
      .sort({ 'accessRequest.requestedAt': -1 });

    res.json({
      success: true,
      count: users.length,
      data: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        contactNo: u.contactNo,
        accessRequest: u.accessRequest,
        requestedModuleId: u.accessRequest?.moduleId || '',
        requestedModuleName: u.accessRequest?.moduleName || '',
        rights: u.rights,
        fullModuleAccessGranted: u.fullModuleAccessGranted
      }))
    });
  } catch (error) {
    console.error("Get module access requests error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reviewModuleAccessRequest = async (req, res) => {
  try {
    if (!canReviewAccessRequests(req.user)) {
      return res.status(403).json({ success: false, message: "Access denied. Admin or Manager only." });
    }

    const { id } = req.params;
    const { action, comments } = req.body;
    if (!['grant', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be grant or reject" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.accessRequest = {
      status: action === 'grant' ? 'granted' : 'rejected',
      message: comments || user.accessRequest?.message || '',
      moduleId: user.accessRequest?.moduleId || '',
      moduleName: user.accessRequest?.moduleName || '',
      requestedAt: user.accessRequest?.requestedAt,
      reviewedAt: new Date(),
      reviewedBy: req.user._id || req.user.id,
      reviewedByName: req.user.name,
      reviewedByEmail: req.user.email
    };

    if (action === 'grant') {
      const requestedRight = MODULE_ID_TO_RIGHT[user.accessRequest?.moduleId] || 'nppProcurement';
      user.fullModuleAccessGranted = false;
      user.rights = { ...(user.rights?.toObject ? user.rights.toObject() : user.rights || {}), [requestedRight]: true };
    }

    await user.save();

    await sendMail({
      to: user.email,
      subject: action === 'grant' ? 'Module Access Granted - LCGC RFQ' : 'Module Access Request Rejected - LCGC RFQ',
      html: `<p>Hello ${user.name},</p><p>Your access request for <strong>${user.accessRequest.moduleName || 'the requested module'}</strong> has been <strong>${user.accessRequest.status}</strong>.</p>`,
      text: `Your access request for ${user.accessRequest.moduleName || 'the requested module'} has been ${user.accessRequest.status}.`
    });

    res.json({
      success: true,
      message: action === 'grant' ? "Access request accepted" : "Access request rejected",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        rights: user.rights,
        fullModuleAccessGranted: user.fullModuleAccessGranted,
        accessRequest: user.accessRequest
      }
    });
  } catch (error) {
    console.error("Review module access request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
