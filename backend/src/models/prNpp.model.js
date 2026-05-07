const express = require('express');
const router = express.Router();

// Simple middleware for development (since verifyToken might not exist)
const verifyToken = (req, res, next) => {
  req.user = { id: 'test-user-id', name: 'Test User', email: 'test@example.com' };
  next();
};

// In-memory storage for demo (replace with actual controller later)
let prNppStore = [];

// Create PR NPP
router.post('/', verifyToken, async (req, res) => {
  try {
    const newPr = {
      _id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      uniqueSerialNo: `PR-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    };
    prNppStore.unshift(newPr);
    console.log('✅ PR NPP created:', newPr._id);
    res.status(201).json({ success: true, message: 'PR NPP created successfully', serialNumber: newPr.uniqueSerialNo, data: newPr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all PR NPP
router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ success: true, data: prNppStore });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single PR NPP
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const pr = prNppStore.find(p => p._id === req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update PR NPP
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const index = prNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PR NPP not found" });
    prNppStore[index] = { ...prNppStore[index], ...req.body, updatedAt: new Date() };
    res.json({ success: true, data: prNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete PR NPP
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const index = prNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PR NPP not found" });
    prNppStore.splice(index, 1);
    res.json({ success: true, message: "PR NPP deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Approve PR NPP
router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const index = prNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PR NPP not found" });
    prNppStore[index].status = 'Approved';
    prNppStore[index].approvedAt = new Date();
    prNppStore[index].approvalComments = req.body.comments;
    res.json({ success: true, message: "PR NPP approved", data: prNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject PR NPP
router.patch('/:id/reject', verifyToken, async (req, res) => {
  try {
    const index = prNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PR NPP not found" });
    prNppStore[index].status = 'Rejected';
    prNppStore[index].rejectedAt = new Date();
    prNppStore[index].rejectionComments = req.body.comments;
    res.json({ success: true, message: "PR NPP rejected", data: prNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;