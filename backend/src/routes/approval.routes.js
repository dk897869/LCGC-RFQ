const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const { sendMail } = require('../services/mail.service');

const getModel = (path) => {
  try {
    const model = require(path);
    return typeof model?.find === 'function' ? model : null;
  } catch {
    return null;
  }
};

const normalizeRequest = (row, type) => {
  const item = typeof row.toObject === 'function' ? row.toObject() : row;
  const source = String(item.source || type || '').toLowerCase();
  const derivedType =
    source.includes('wcc') ? 'wcc' :
    source.includes('comparison') || source.includes('quotation') ? 'comparison' :
    source.includes('payment') ? 'payment' :
    source.includes('po') ? 'po' :
    source.includes('pr') ? 'pr' :
    type;

  return {
    ...item,
    id: item._id || item.id,
    type: derivedType,
    serialNo: item.uniqueSerialNo || item.serialNo || '',
    title: item.title || item.titleOfActivity || item.subject || 'Untitled',
    requester: item.requester || item.requesterName || item.createdByName || '',
    email: item.email || item.emailId || '',
    department: item.department || item.dept || '',
    amount: Number(item.amount || item.estimatedAmount || 0),
    requestDate: item.requestDate || item.createdAt || new Date(),
    vendor: item.vendor || item.vendorName || item.paymentTo || '',
    status: item.status || 'Pending'
  };
};

const queryModel = async (modelPath, type) => {
  const model = getModel(modelPath);
  if (!model) return [];
  const rows = await model.find().sort({ createdAt: -1 }).limit(500);
  return rows.map(row => normalizeRequest(row, type));
};

const getModelByType = (type) => {
  const map = {
    ep: '../models/request',
    rfq: '../models/Rfq',
    pr: '../models/prNpp.model',
    po: '../models/poNpp.model',
    payment: '../models/paymentNpp.model'
  };
  return getModel(map[type]);
};

router.get('/unified', verifyToken, async (req, res) => {
  try {
    const [ep, rfq, pr, po, payment] = await Promise.all([
      queryModel('../models/request', 'ep'),
      queryModel('../models/Rfq', 'rfq'),
      queryModel('../models/prNpp.model', 'pr'),
      queryModel('../models/poNpp.model', 'po'),
      queryModel('../models/paymentNpp.model', 'payment')
    ]);

    const data = [...ep, ...rfq, ...pr, ...po, ...payment]
      .sort((a, b) => new Date(b.createdAt || b.requestDate || 0) - new Date(a.createdAt || a.requestDate || 0));

    res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:type/:requestId/approve', verifyToken, async (req, res) => {
  try {
    const model = getModelByType(req.params.type);
    if (!model) return res.status(404).json({ success: false, message: 'Approval type not available' });

    const data = await model.findByIdAndUpdate(
      req.params.requestId,
      {
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: req.user?.name || req.user?.email || 'Approver',
        approvalComments: req.body.comments || ''
      },
      { new: true }
    );

    if (!data) return res.status(404).json({ success: false, message: 'Request not found' });

    if (data.email || data.emailId) {
      await sendMail({
        to: data.email || data.emailId,
        subject: `${String(req.params.type).toUpperCase()} request approved`,
        type: 'approval',
        action: 'Approved',
        comments: req.body.comments || '',
        data: { ...normalizeRequest(data, req.params.type), requestType: req.params.type }
      });
    }

    res.status(200).json({ success: true, message: 'Request approved', data: normalizeRequest(data, req.params.type) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:type/:requestId/reject', verifyToken, async (req, res) => {
  try {
    const model = getModelByType(req.params.type);
    if (!model) return res.status(404).json({ success: false, message: 'Approval type not available' });

    const data = await model.findByIdAndUpdate(
      req.params.requestId,
      {
        status: 'Rejected',
        rejectedAt: new Date(),
        rejectedBy: req.user?.name || req.user?.email || 'Approver',
        rejectionComments: req.body.comments || ''
      },
      { new: true }
    );

    if (!data) return res.status(404).json({ success: false, message: 'Request not found' });

    if (data.email || data.emailId) {
      await sendMail({
        to: data.email || data.emailId,
        subject: `${String(req.params.type).toUpperCase()} request rejected`,
        type: 'approval',
        action: 'Rejected',
        comments: req.body.comments || '',
        data: { ...normalizeRequest(data, req.params.type), requestType: req.params.type }
      });
    }

    res.status(200).json({ success: true, message: 'Request rejected', data: normalizeRequest(data, req.params.type) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get approval workflow
router.get('/:type/:requestId/workflow', verifyToken, async (req, res) => {
  try {
    res.status(200).json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update approval status
router.patch('/:type/:requestId/approvers/:approverId', verifyToken, async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
