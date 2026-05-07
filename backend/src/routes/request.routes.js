const express = require('express');
const router = express.Router();
const requestController = require('../controllers/request.controller');
const { verifyToken } = require('../middlewares/auth');

// Apply authentication to all routes
router.use(verifyToken);

// Dashboard & Stats
router.get('/stats/dashboard', requestController.getDashboardStats);
router.get('/departments', requestController.getDepartments);

// User specific
router.get('/my-pending', requestController.getMyPendingRequests);

// Filter routes (place before /:id to avoid conflicts)
router.get('/status/:status', requestController.getRequestsByStatus);
router.get('/department/:department', requestController.getRequestsByDepartment);

// CRUD operations
router.get('/', requestController.getRequests);
router.post('/', requestController.createRequest);
router.get('/:id', requestController.getRequestById);
router.put('/:id', requestController.updateRequest);
router.delete('/:id', requestController.deleteRequest);

// Approval actions
router.patch('/:id/approve', requestController.approveRequest);
router.patch('/:id/reject', requestController.rejectRequest);

module.exports = router;