const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

const {
  getAllRFQs,
  createRFQ,
  getRFQById,
  getRFQBySerial,
  updateRFQ,
  deleteRFQ,
  approveRFQ,
  rejectRFQ,
  getVendors,
  getDepartments,
  getApprovedRFQs,
  getRFQsByVendorStatus,
  getRFQWorkflowStatus
} = require('../controllers/Rfq.controller');

// Public routes (no auth required)
router.get('/departments', getDepartments);
router.get('/vendors', getVendors);

// Protected routes - IMPORTANT: Specific routes BEFORE parameterized routes
router.get('/approved', authMiddleware, getApprovedRFQs);  // ✅ MUST come before /:id
router.get('/vendor-status', authMiddleware, getRFQsByVendorStatus);

// Parameterized routes
router.get('/', authMiddleware, getAllRFQs);
router.post('/', authMiddleware, createRFQ);
router.get('/serial/:serialNumber', authMiddleware, getRFQBySerial);
router.get('/:id', authMiddleware, getRFQById);
router.put('/:id', authMiddleware, updateRFQ);
router.delete('/:id', authMiddleware, deleteRFQ);

// Approval routes
router.patch('/:id/approve', authMiddleware, approveRFQ);
router.patch('/:id/reject', authMiddleware, rejectRFQ);

// Workflow routes
router.get('/:id/workflow', authMiddleware, getRFQWorkflowStatus);

module.exports = router;