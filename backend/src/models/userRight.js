const mongoose = require("mongoose");

const userRightSchema = new mongoose.Schema({
  userRight: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  view: { type: Boolean, default: false },
  creationEdit: { type: Boolean, default: false },
  approval: { type: Boolean, default: false },
  action: { type: String, default: "Request" },
  status: { type: String, default: "In-process" }
}, { timestamps: true });

module.exports = mongoose.model("UserRight", userRightSchema);