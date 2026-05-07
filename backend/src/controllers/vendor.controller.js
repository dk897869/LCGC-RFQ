const mongoose = require("mongoose");
const Vendor = require("../models/vendor");

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
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format. ID must be a valid MongoDB ObjectId." 
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
    // Validate required fields
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
    
    // Check for duplicate email
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
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format. ID must be a valid MongoDB ObjectId." 
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
    
    // Validate ObjectId format
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
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid vendor ID format. ID must be a valid MongoDB ObjectId." 
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

// Search Vendors
exports.searchVendors = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: "Search query is required" 
      });
    }
    
    const vendors = await Vendor.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { company: { $regex: query, $options: "i" } },
        { gst: { $regex: query, $options: "i" } }
      ]
    }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: vendors,
      count: vendors.length
    });
  } catch (err) {
    console.error("Search Vendors Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
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