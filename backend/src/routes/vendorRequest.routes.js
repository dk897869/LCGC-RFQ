const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const {
  createVendorRequest,
  getAllVendorRequests,
  getVendorRequestByRfqId,
  getVendorRequestById,
  updateVendorRequest,
  updateVendorStatus,
  deleteVendorRequest
} = require('../controllers/vendorRequest.controller');

// All routes require authentication
router.use(authMiddleware);

// Create vendor request
router.post('/', createVendorRequest);

// Get all vendor requests
router.get('/', getAllVendorRequests);

// Get vendor request by RFQ ID
router.get('/rfq/:rfqId', getVendorRequestByRfqId);

// Get vendor request by ID
router.get('/:id', getVendorRequestById);

// Update vendor request
router.patch('/:id', updateVendorRequest);

// Update vendor status
router.patch('/:id/vendor/:vendorIndex', updateVendorStatus);

// Delete vendor request
router.delete('/:id', deleteVendorRequest);

module.exports = router;