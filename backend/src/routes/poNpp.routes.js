const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/mail.service');
const verifyToken = (req, res, next) => {
  req.user = { id: 'test-user-id', name: 'Test User', email: 'test@example.com' };
  next();
};
let poNppStore = [];
const emailRecipients = (body) => [
  body.emailId,
  body.email,
  body.requesterEmail,
  body.vendorEmail,
  ...(body.ccList || []),
  ...((body.stakeholders || []).map(s => s.email).filter(Boolean))
].filter(Boolean);

const notifyPo = async (data, action, comments = '') => {
  const recipients = [...new Set(emailRecipients(data))];
  if (!recipients.length) return;
  await sendMail({
    to: recipients[0],
    cc: recipients.slice(1),
    subject: `PO ${action}: ${data.orderNo || data.titleOfActivity || data.uniqueSerialNo}`,
    type: 'po',
    action,
    comments,
    data
  });
};
router.post('/', verifyToken, async (req, res) => {
  try {
    const newPo = {
      _id: Date.now().toString(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      uniqueSerialNo: `PO-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    };
    poNppStore.unshift(newPo);
    await notifyPo(newPo, 'created');
    console.log('✅ PO NPP created:', newPo._id);
    res.status(201).json({ success: true, message: 'PO NPP created successfully', serialNumber: newPo.uniqueSerialNo, data: newPo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({ success: true, data: poNppStore });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/serial/:serialNo', verifyToken, async (req, res) => {
  try {
    const po = poNppStore.find(p => p.uniqueSerialNo === req.params.serialNo);
    if (!po) return res.status(404).json({ success: false, message: "PO NPP not found" });
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const po = poNppStore.find(p => p._id === req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "PO NPP not found" });
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const index = poNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PO NPP not found" });
    poNppStore[index] = { ...poNppStore[index], ...req.body, updatedAt: new Date() };
    res.json({ success: true, data: poNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const index = poNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PO NPP not found" });
    poNppStore.splice(index, 1);
    res.json({ success: true, message: "PO NPP deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const index = poNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PO NPP not found" });
    poNppStore[index].status = 'Approved';
    poNppStore[index].approvedAt = new Date();
    poNppStore[index].approvalComments = req.body.comments;
    await notifyPo(poNppStore[index], 'approved', req.body.comments || '');
    res.json({ success: true, message: "PO NPP approved", data: poNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.patch('/:id/reject', verifyToken, async (req, res) => {
  try {
    const index = poNppStore.findIndex(p => p._id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "PO NPP not found" });
    poNppStore[index].status = 'Rejected';
    poNppStore[index].rejectedAt = new Date();
    poNppStore[index].rejectionComments = req.body.comments;
    await notifyPo(poNppStore[index], 'rejected', req.body.comments || '');
    res.json({ success: true, message: "PO NPP rejected", data: poNppStore[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = router;
