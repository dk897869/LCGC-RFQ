const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const {
  submitQuotation,
  getQuotationsByRfqId,
  getQuotationComparison,
  updateQuotationStatus,
  selectWinner
} = require('../controllers/quotation.controller');

// All routes require authentication
router.use(authMiddleware);

// Submit quotation
router.post('/', submitQuotation);

// Get quotations by RFQ ID
router.get('/rfq/:rfqId', getQuotationsByRfqId);

// Get quotation comparison
router.get('/comparison/:rfqId', getQuotationComparison);

// Update quotation status
router.patch('/:id/status', updateQuotationStatus);

// Select winner
router.post('/:rfqId/winner', selectWinner);

module.exports = router;