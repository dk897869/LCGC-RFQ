const express = require('express');
const router = express.Router();
const poNppController = require('../controllers/poNpp.controller');
const { verifyToken } = require('../middlewares/auth');

// Create PO NPP
router.post('/', verifyToken, poNppController.createPoNpp);

// Get all PO NPP
router.get('/', verifyToken, poNppController.listPoNpp);

// Get single PO NPP by ID
router.get('/:id', verifyToken, poNppController.getPoNpp);

// Update PO NPP
router.put('/:id', verifyToken, poNppController.updatePoNpp);

// Delete PO NPP
router.delete('/:id', verifyToken, poNppController.deletePoNpp);

// Approve PO NPP (both PATCH and POST supported)
router.patch('/:id/approve', verifyToken, poNppController.approvePoNpp);
router.post('/:id/approve', verifyToken, poNppController.approvePoNpp);

// Reject PO NPP (both PATCH and POST supported)
router.patch('/:id/reject', verifyToken, poNppController.rejectPoNpp);
router.post('/:id/reject', verifyToken, poNppController.rejectPoNpp);

module.exports = router;
