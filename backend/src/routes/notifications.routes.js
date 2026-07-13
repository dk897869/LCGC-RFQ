const express = require('express');
const router = express.Router();
const Notification = require('../models/notification.model');
const { sendMail } = require('../services/mail.service');

// Get all notifications for logged-in user
router.get('/', async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    const query = {};
    
    // If regular user, show only their notifications. If admin, show all.
    if (!['Admin', 'Manager', 'Senior Manager'].includes(req.user?.role)) {
      query.userEmail = email;
    }
    
    const list = await Notification.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark all as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    const query = {};
    if (!['Admin', 'Manager', 'Senior Manager'].includes(req.user?.role)) {
      query.userEmail = email;
    }
    await Notification.updateMany(query, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const sendNotification = async (req, res, subject, type) => {
  try {
    const { recipients = [], rfqData, prData, poData, purchaseData, requestData, approvers } = req.body;
    const data = rfqData || prData || poData || purchaseData || requestData || req.body;
    const toList = Array.isArray(recipients) && recipients.length
      ? recipients
      : [data?.email, data?.emailId, data?.requesterEmail].filter(Boolean);
    if (!toList.length) {
      return res.status(200).json({ success: true, message: 'No recipients — skipped', sent: false });
    }
    
    // Create database Notification record as well!
    try {
      await Notification.create({
        userEmail: toList[0],
        title: subject,
        message: data?.title || data?.titleOfActivity || 'Procurement activity update',
        type: type || 'system',
        status: data?.status || 'pending'
      });
    } catch (dbErr) {
      console.error('Failed to create DB notification:', dbErr.message);
    }

    await sendMail({
      to: toList[0],
      cc: toList.slice(1).concat(Array.isArray(approvers) ? approvers : []),
      subject,
      type,
      action: 'created',
      data
    });
    res.status(200).json({ success: true, message: 'Notification sent', sent: true });
  } catch (error) {
    console.error(`Notification error (${type}):`, error.message);
    res.status(200).json({ success: true, message: 'Notification queued (email may be delayed)', sent: false });
  }
};

router.post('/rfq-email', (req, res) => sendNotification(req, res, 'RFQ Request Notification', 'rfq'));
router.post('/pr-email', (req, res) => sendNotification(req, res, 'PR Request Notification', 'pr'));
router.post('/po-email', (req, res) => sendNotification(req, res, 'PO Request Notification', 'po'));
router.post('/cash-purchase-email', (req, res) => sendNotification(req, res, 'Cash Purchase Notification', 'cash-purchase'));
router.post('/approval-email', (req, res) => sendNotification(req, res, 'Approval Request', 'approval'));
router.post('/ep-request', (req, res) => sendNotification(req, res, 'EP Request Submitted', 'ep'));

module.exports = router;
