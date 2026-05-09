const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

const {
  getAllRFQs,
  createRFQ,
  getRFQById,
  updateRFQ,
  deleteRFQ,
  approveRFQ,
  rejectRFQ,
  getVendors,
  getDepartments,
} = require('../controllers/Rfq.controller');

// Public routes
router.get('/departments', getDepartments);
router.get('/vendors', getVendors);

// Protected routes (require authentication)
router.get('/', authMiddleware, getAllRFQs);
router.post('/', authMiddleware, createRFQ);
router.get('/:id', authMiddleware, getRFQById);
router.put('/:id', authMiddleware, updateRFQ);
router.delete('/:id', authMiddleware, deleteRFQ);

// Approval routes
router.patch('/:id/approve', authMiddleware, approveRFQ);
router.patch('/:id/reject', authMiddleware, rejectRFQ);

module.exports = router;