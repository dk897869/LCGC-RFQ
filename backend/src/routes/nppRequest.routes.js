const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const nppController = require('../controllers/npp.controller');

// Create NPP requests
router.post('/cash-purchase', authMiddleware, nppController.createNppRequest);
router.post('/new-vendor', authMiddleware, nppController.createNppRequest);
router.post('/rfq-vendor', authMiddleware, nppController.createNppRequest);
router.post('/rfq-requisition', authMiddleware, nppController.createNppRequest);
router.post('/vendor-list', authMiddleware, nppController.createNppRequest);
router.post('/employee-detail', authMiddleware, nppController.createNppRequest);
router.post('/item-master', authMiddleware, nppController.createNppRequest);
router.post('/quotation-comparison', authMiddleware, nppController.createNppRequest);
router.post('/pr-request', authMiddleware, nppController.createNppRequest);
router.post('/po-npp', authMiddleware, nppController.createNppRequest);
router.post('/payment-advise', authMiddleware, nppController.createNppRequest);
router.post('/wcc-npp', authMiddleware, nppController.createNppRequest);

// Get NPP requests
router.get('/', authMiddleware, nppController.getAllNppRequests);
router.get('/stats', authMiddleware, nppController.getNppStats);
router.get('/:id', authMiddleware, nppController.getNppRequestById);
router.get('/serial/:serialNo', authMiddleware, nppController.getNppRequestBySerialNo);

// Update/Delete
router.put('/:id', authMiddleware, nppController.updateNppRequest);
router.delete('/:id', authMiddleware, nppController.deleteNppRequest);

// Approve/Reject
router.patch('/:id/approve', authMiddleware, nppController.approveNppRequest);
router.patch('/:id/reject', authMiddleware, nppController.rejectNppRequest);
router.post('/:id/send-email', authMiddleware, nppController.sendNppRequestEmail);

module.exports = router;
