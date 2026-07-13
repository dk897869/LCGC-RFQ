const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/mail.service');
const verifyToken = (req, res, next) => {
  req.user = { id: 'test-user-id', name: 'Test User', email: 'test@example.com' };
  next();
};
let paymentNppStore = [];
const emailRecipients = (body) => [
  body.emailId,
  body.email,
  body.requesterEmail,
  body.vendorEmail,
  ...(body.ccList || []),
  ...((body.stakeholders || []).map(s => s.email).filter(Boolean))
].filter(Boolean);

const notifyPayment = async (data, action, comments = '') => {
  const recipients = [...new Set(emailRecipients(data))];
  if (!recipients.length) return;
  await sendMail({
    to: recipients[0],
    cc: recipients.slice(1),
    subject: `Payment ${action}: ${data.titleOfActivity || data.paymentTo || data.uniqueSerialNo}`,
    type: 'payment',
    action,
    comments,
    data
  });

  try {
    const { createNotification } = require('../services/notification.service');
    const title = `Payment Advice ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    const msg = `Payment Advice ${data.uniqueSerialNo || ''} (${data.titleOfActivity || data.paymentTo || 'Untitled'}) has been ${action}.`;
    const type = action === 'created' ? 'pending' : action;
    for (const email of recipients) {
      await createNotification(email, title, msg, type);
    }
  } catch (err) {
    console.error('⚠️ Error in notifyPayment database notifications:', err.message);
  }
};
router.post('/', verifyToken, async (req, res) => {
  try {
    const newPayment = {
      _id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      uniqueSerialNo: `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    };
    paymentNppStore.unshift(newPayment);
    await notifyPayment(newPayment, 'created');
    console.log('✅ Payment NPP created:', newPayment._id);
    res.status(201).json({ success: true, message: 'Payment Advice created successfully', serialNumber: newPayment.uniqueSerialNo, data: newPayment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ success: true, data: paymentNppStore });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/serial/:serialNo', verifyToken, async (req, res) => {
  try {
    const payment = paymentNppStore.find(p => p.uniqueSerialNo === req.params.serialNo);
    if (!payment) return res.status(404).json({ success: false, message: "Payment advice not found" });
    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const payment = paymentNppStore.find(p => p._id === req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Payment advice not found" });
    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const index = paymentNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "Payment advice not found" });
    paymentNppStore[index] = { ...paymentNppStore[index], ...req.body, updatedAt: new Date() };
    res.json({ success: true, data: paymentNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const index = paymentNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "Payment advice not found" });
    paymentNppStore.splice(index, 1);
    res.json({ success: true, message: "Payment advice deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const index = paymentNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "Payment advice not found" });
    paymentNppStore[index].status = 'Approved';
    paymentNppStore[index].approvedAt = new Date();
    paymentNppStore[index].approvalComments = req.body.comments;
    await notifyPayment(paymentNppStore[index], 'approved', req.body.comments || '');
    res.json({ success: true, message: "Payment advice approved", data: paymentNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.patch('/:id/reject', verifyToken, async (req, res) => {
  try {
    const index = paymentNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "Payment advice not found" });
    paymentNppStore[index].status = 'Rejected';
    paymentNppStore[index].rejectedAt = new Date();
    paymentNppStore[index].rejectionComments = req.body.comments;
    await notifyPayment(paymentNppStore[index], 'rejected', req.body.comments || '');
    res.json({ success: true, message: "Payment advice rejected", data: paymentNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = router;
