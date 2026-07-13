const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PrNpp = require('../models/prNpp.model');
const Request = require('../models/request');
const Rfq = require('../models/Rfq');
const { sendMail } = require('../services/mail.service');
const prComparisonCtrl = require('../controllers/prComparison.controller');
const { createNotification } = require('../services/notification.service');

const emailRecipients = (body) => [
  body.emailId,
  body.email,
  body.requesterEmail,
  ...(body.ccList || []),
  ...((body.approvalChain || []).map(s => s.email || s.stakeholder).filter(Boolean))
].filter(Boolean);

const notifyPr = async (data, action, comments = '') => {
  const recipients = [...new Set(emailRecipients(data))];
  if (!recipients.length) return;
  await sendMail({
    to: recipients[0],
    cc: recipients.slice(1),
    subject: `PR ${action.toUpperCase()}: ${data.titleOfActivity || data.title || data.uniqueSerialNo}`,
    type: 'pr',
    action,
    comments,
    data
  });

  try {
    const title = `PR Request ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    const msg = `PR request ${data.uniqueSerialNo || ''} (${data.titleOfActivity || data.title || 'Untitled'}) has been ${action}.`;
    const type = action === 'created' ? 'pending' : action;
    for (const email of recipients) {
      await createNotification(email, title, msg, type);
    }
  } catch (err) {
    console.error('⚠️ Error in notifyPr database notifications:', err.message);
  }
};

// Create PR NPP
router.post('/', async (req, res) => {
  try {
    const uniqueSerialNo = `PR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    let approvalChain = req.body.approvalChain || [];
    
    // Look up stakeholders according to associated RFQ and EP request
    if ((!approvalChain || !approvalChain.length || approvalChain.every(a => !a.stakeholder)) && req.body.rfqNo) {
      console.log(`🔍 Looking up stakeholders for associated RFQ/EP request: ${req.body.rfqNo}`);
      
      // Look up stakeholders from EP Request
      const epReq = await Request.findOne({
        $or: [
          { rfqNo: req.body.rfqNo },
          { requestId: req.body.rfqNo },
          { title: req.body.rfqNo }
        ]
      });
      
      if (epReq && epReq.stakeholders && epReq.stakeholders.length) {
        approvalChain = epReq.stakeholders.map(s => ({
          line: s.line || 'Parallel',
          stakeholder: s.name,
          email: s.email,
          designation: s.designation || 'Approver',
          status: 'Pending',
          comments: s.remarks || ''
        }));
        console.log(`✅ Loaded ${approvalChain.length} approvers from EP request`);
      } else {
        // Look up stakeholders from RFQ
        const rfqReq = await Rfq.findOne({
          $or: [
            { rfqNo: req.body.rfqNo },
            { _id: mongoose.isValidObjectId(req.body.rfqNo) ? req.body.rfqNo : null }
          ].filter(Boolean)
        });
        
        if (rfqReq && rfqReq.stakeholders && rfqReq.stakeholders.length) {
          approvalChain = rfqReq.stakeholders.map(s => ({
            line: s.line || 'Parallel',
            stakeholder: s.name,
            email: s.email,
            designation: s.designation || 'Approver',
            status: 'Pending',
            comments: s.remarks || ''
          }));
          console.log(`✅ Loaded ${approvalChain.length} approvers from RFQ request`);
        }
      }
    }

    const newPr = new PrNpp({
      ...req.body,
      uniqueSerialNo,
      approvalChain
    });

    await newPr.save();
    await notifyPr(newPr, 'created');
    console.log('✅ PR NPP created in database:', newPr._id);
    res.status(201).json({ success: true, message: 'PR NPP created successfully', serialNumber: newPr.uniqueSerialNo, data: newPr });
  } catch (err) {
    console.error('Error creating PR NPP:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all PR NPP
router.get('/', async (req, res) => {
  try {
    const list = await PrNpp.find().sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single PR NPP by serial number
router.get('/serial/:serialNo', async (req, res) => {
  try {
    const pr = await PrNpp.findOne({ uniqueSerialNo: req.params.serialNo });
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get comparison details for a PR
router.get('/:prId/comparison', prComparisonCtrl.getComparison);

// Get single PR NPP by database ID
router.get('/:id', async (req, res) => {
  try {
    const pr = await PrNpp.findById(req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update PR NPP
router.put('/:id', async (req, res) => {
  try {
    const pr = await PrNpp.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete PR NPP
router.delete('/:id', async (req, res) => {
  try {
    const pr = await PrNpp.findByIdAndDelete(req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, message: "PR NPP deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Approve PR NPP
router.patch('/:id/approve', async (req, res) => {
  try {
    const pr = await PrNpp.findById(req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    
    pr.status = 'Approved';
    pr.approvedAt = new Date();
    pr.approvalComments = req.body.comments;
    
    await pr.save();
    await notifyPr(pr, 'approved', req.body.comments || '');
    res.json({ success: true, message: "PR NPP approved", data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject PR NPP
router.patch('/:id/reject', async (req, res) => {
  try {
    const pr = await PrNpp.findById(req.params.id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    
    pr.status = 'Rejected';
    pr.rejectedAt = new Date();
    pr.rejectionComments = req.body.comments;
    
    await pr.save();
    await notifyPr(pr, 'rejected', req.body.comments || '');
    res.json({ success: true, message: "PR NPP rejected", data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
