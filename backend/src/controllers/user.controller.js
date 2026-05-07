const mongoose = require("mongoose");
const User = require("../models/user.model");

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