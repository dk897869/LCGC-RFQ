const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const nppController = require('../controllers/npp.controller');

const allowedTypes = new Set([
  'rfq-vendor',
  'rfq-request',
  'rfq-requisition',
  'requisition',
  'quotation-submission',
  'quotation',
  'quotation-comparison',
  'quotation-collection',
  'pr-request',
  'pr',
  'po-npp',
  'po',
  'payment-advise',
  'payment',
  'wcc-npp',
  'wcc',
  'cash-purchase',
  'new-vendor',
  'vendor-list',
  'employee-detail',
  'item-master'
]);

const validateType = (req, res, next) => {
  if (!allowedTypes.has(req.params.type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid form type',
      allowedTypes: Array.from(allowedTypes)
    });
  }
  next();
};

router.get('/search', authMiddleware, nppController.searchNppRequests);
router.get('/quotation-comparison/auto', authMiddleware, async (req, res) => {
  try {
    const prComparisonCtrl = require('../controllers/prComparison.controller');
    req.params.prId = req.query.rfqNo || 'latest';
    return prComparisonCtrl.getComparison(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/serial/:serialNo', authMiddleware, nppController.getNppRequestBySerialNo);
router.get('/rfq/:rfqNo', authMiddleware, nppController.getNppRequestsByRfqNo);
router.get('/', authMiddleware, nppController.getAllNppRequests);
router.get('/:type', authMiddleware, validateType, nppController.getAllNppRequests);
router.post('/:type', authMiddleware, validateType, nppController.createNppRequest);
router.get('/:type/:id', authMiddleware, validateType, nppController.getNppRequestById);
router.put('/:type/:id', authMiddleware, validateType, nppController.updateNppRequest);
router.patch('/:type/:id/approve', authMiddleware, validateType, nppController.approveNppRequest);
router.patch('/:type/:id/reject', authMiddleware, validateType, nppController.rejectNppRequest);
router.delete('/:type/:id', authMiddleware, validateType, nppController.deleteNppRequest);
router.post('/:type/:id/send-email', authMiddleware, validateType, nppController.sendNppRequestEmail);

module.exports = router;
