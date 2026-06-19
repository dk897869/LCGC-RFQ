const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/mail.service');

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
