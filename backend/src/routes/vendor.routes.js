const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const vendorController = require('../controllers/vendor.controller');

// All routes require authentication
router.use(authMiddleware);

// GET routes - IMPORTANT: Specific routes BEFORE parameterized routes
router.get('/search', vendorController.searchVendors);
router.get('/stats', vendorController.getVendorStats);
router.get('/my-rfqs', vendorController.getMyVendorRfqs);
router.get('/dashboard/rfqs', vendorController.getMyVendorRfqs); // ✅ For dashboard compatibility
router.get('/findByEmail', vendorController.findVendorByEmail);
router.get('/', vendorController.getVendors);

// GET by ID - MUST come AFTER specific routes
router.get('/:id', vendorController.getVendorById);

// POST routes
router.post('/', vendorController.addVendor);
router.post('/temporary-account', vendorController.createTemporaryVendorAccount);
router.post('/rfqs/:id/accept', vendorController.acceptVendorRfq); // ✅ Vendor accept RFQ
router.post('/rfqs/:id/reject', vendorController.rejectVendorRfq); // ✅ Vendor reject RFQ

// PUT/PATCH routes
router.put('/:id', vendorController.updateVendor);
router.patch('/:id', vendorController.updateVendor);
router.patch('/:id/status', vendorController.updateVendorStatus);

// DELETE routes
router.delete('/:id', vendorController.deleteVendor);

// Deactivate temporary vendor account
router.patch('/temporary-account/:id/deactivate', vendorController.deactivateTemporaryVendorAccount);

module.exports = router;