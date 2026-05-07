const mongoose = require("mongoose");
const Part = require("../models/part");

// GET All Parts
exports.getParts = async (req, res) => {
  try {
    const parts = await Part.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: parts,
      count: parts.length 
    });
  } catch (err) {
    console.error("Get Parts Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// GET Single Part by ID
exports.getPartById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid part ID format. ID must be a valid MongoDB ObjectId." 
      });
    }
    
    const part = await Part.findById(id);
    if (!part) {
      return res.status(404).json({ 
        success: false, 
        message: "Part not found" 
      });
    }
    res.json({ success: true, data: part });
  } catch (err) {
    console.error("Get Part By ID Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// CREATE Part
exports.addPart = async (req, res) => {
  try {
    // Validate required fields
    const { partCode, description, price } = req.body;
    
    if (!partCode) {
      return res.status(400).json({ 
        success: false, 
        message: "Part code is required" 
      });
    }
    
    if (!description) {
      return res.status(400).json({ 
        success: false, 
        message: "Description is required" 
      });
    }
    
    if (!price || price <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid price is required" 
      });
    }
    
    // Check for duplicate part code
    const existingPart = await Part.findOne({ partCode: partCode.toUpperCase() });
    if (existingPart) {
      return res.status(400).json({ 
        success: false, 
        message: "Part code already exists" 
      });
    }
    
    const partData = {
      ...req.body,
      partCode: partCode.toUpperCase(),
      status: req.body.status || "Active",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const part = await Part.create(partData);
    res.status(201).json({ 
      success: true, 
      message: "Part added successfully", 
      data: part 
    });
  } catch (err) {
    console.error("Add Part Error:", err);
    
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

// UPDATE Part
exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid part ID format. ID must be a valid MongoDB ObjectId." 
      });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const part = await Part.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!part) {
      return res.status(404).json({ 
        success: false, 
        message: "Part not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Part updated successfully", 
      data: part 
    });
  } catch (err) {
    console.error("Update Part Error:", err);
    
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

// Update Part Status
exports.updatePartStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid part ID format" 
      });
    }
    
    const part = await Part.findByIdAndUpdate(
      id,
      { 
        status, 
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );
    
    if (!part) {
      return res.status(404).json({ 
        success: false, 
        message: "Part not found" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Part status updated successfully", 
      data: part 
    });
  } catch (err) {
    console.error("Update Part Status Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Update Part Quantity
exports.updatePartQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation } = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid part ID format" 
      });
    }
    
    const part = await Part.findById(id);
    if (!part) {
      return res.status(404).json({ 
        success: false, 
        message: "Part not found" 
      });
    }
    
    let newQuantity = part.quantity;
    if (operation === "add") {
      newQuantity = part.quantity + quantity;
    } else if (operation === "subtract") {
      newQuantity = part.quantity - quantity;
      if (newQuantity < 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Insufficient stock" 
        });
      }
    } else {
      newQuantity = quantity;
    }
    
    const updatedPart = await Part.findByIdAndUpdate(
      id,
      { 
        quantity: newQuantity,
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true, 
      message: "Part quantity updated successfully", 
      data: updatedPart 
    });
  } catch (err) {
    console.error("Update Part Quantity Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// DELETE Part
exports.deletePart = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid part ID format. ID must be a valid MongoDB ObjectId." 
      });
    }
    
    const part = await Part.findByIdAndDelete(id);
    if (!part) {
      return res.status(404).json({ 
        success: false, 
        message: "Part not found" 
      });
    }
    res.json({ 
      success: true, 
      message: "Part deleted successfully" 
    });
  } catch (err) {
    console.error("Delete Part Error:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Get Low Stock Parts
exports.getLowStockParts = async (req, res) => {
  try {
    const lowStockParts = await Part.findLowStock();
    res.json({
      success: true,
      data: lowStockParts,
      count: lowStockParts.length
    });
  } catch (err) {
    console.error("Get Low Stock Parts Error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get Category Summary
exports.getCategorySummary = async (req, res) => {
  try {
    const summary = await Part.getCategorySummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error("Get Category Summary Error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};