const UserRight = require("../models/userRight");

// GET All User Rights
exports.getUserRights = async (req, res) => {
  try {
    const rights = await UserRight.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rights });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE User Right
exports.createUserRight = async (req, res) => {
  try {
    const right = await UserRight.create(req.body);
    res.status(201).json({ success: true, message: "User Right created", data: right });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// UPDATE User Right
exports.updateUserRight = async (req, res) => {
  try {
    const updated = await UserRight.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "User Right not found" });
    res.json({ success: true, message: "User Right updated", data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE User Right
exports.deleteUserRight = async (req, res) => {
  try {
    const right = await UserRight.findByIdAndDelete(req.params.id);
    if (!right) return res.status(404).json({ success: false, message: "User Right not found" });
    res.json({ success: true, message: "User Right deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};