const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,  // This creates the index
    lowercase: true,
    trim: true
  },
  phone: String,
  company: String,
  gst: String,
  status: { type: String, default: "Active" }
}, { timestamps: true });

// Remove this line if you have it:
// vendorSchema.index({ email: 1 });

module.exports = mongoose.model("Vendor", vendorSchema);