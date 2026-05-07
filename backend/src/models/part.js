const mongoose = require("mongoose");

const partSchema = new mongoose.Schema({
  partCode: { 
    type: String, 
    required: true, 
    unique: true,  // This creates the index
    trim: true,
    uppercase: true
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  location: String,
  quantity: { type: Number, default: 0 },
  category: String,
  status: { type: String, default: "Active" }
}, { timestamps: true });

// Remove this line if you have it:
// partSchema.index({ partCode: 1 });

module.exports = mongoose.model("Part", partSchema);