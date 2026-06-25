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
  updateVendorRequestStatus,
  updateQuotationStatus,
  selectWinner
} = require('../controllers/Rfq.controller');

// Public routes
router.get('/departments', getDepartments);
router.get('/vendors', getVendors);

// Protected routes (require authentication)
router.get('/', authMiddleware, getAllRFQs);
router.post('/', authMiddleware, createRFQ);
router.get('/serial/:serialNumber', authMiddleware, getRFQBySerial);
router.get('/:id', authMiddleware, getRFQById);
router.put('/:id', authMiddleware, updateRFQ);
router.delete('/:id', authMiddleware, deleteRFQ);

// Approval routes
router.patch('/:id/approve', authMiddleware, approveRFQ);
router.patch('/:id/reject', authMiddleware, rejectRFQ);

// Vendor Request routes
router.get('/approved', authMiddleware, getApprovedRFQs);
router.patch('/:id/vendor-request', authMiddleware, updateVendorRequestStatus);
router.patch('/:id/quotation-status', authMiddleware, updateQuotationStatus);
router.post('/:id/select-winner', authMiddleware, selectWinner);

module.exports = router;