const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

const {
  getAllRFQs,
  createRFQ,
  getRFQById,
  updateRFQ,
  deleteRFQ,
  approveRFQ,      // ✅ Added
  rejectRFQ,       // ✅ Added
  getVendors,
  getDepartments,
} = require('../controllers/Rfq.controller');

// Public routes (if any)
router.get('/departments', getDepartments);
router.get('/vendors', getVendors);

// Protected routes
router.get('/', verifyToken, getAllRFQs);
router.post('/', verifyToken, createRFQ);
router.get('/:id', verifyToken, getRFQById);
router.put('/:id', verifyToken, updateRFQ);
router.delete('/:id', verifyToken, deleteRFQ);

// ✅ ADD THESE APPROVE/REJECT ROUTES
router.patch('/:id/approve', verifyToken, approveRFQ);
router.patch('/:id/reject', verifyToken, rejectRFQ);

module.exports = router;