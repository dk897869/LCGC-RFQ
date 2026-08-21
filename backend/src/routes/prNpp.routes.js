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

// Approve PR NPP (supports both PATCH and POST, and serial number / ObjectId lookup)
const handleApprovePr = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Approver';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const userRole = (req.user?.role || req.user?.designation || '').toLowerCase().trim();

    let pr = null;
    const cleanId = String(id || '').trim();
    if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
      pr = await PrNpp.findById(cleanId);
    }
    if (!pr) {
      pr = await PrNpp.findOne({
        $or: [
          { uniqueSerialNo: cleanId },
          { prNumber: cleanId },
          { serialNo: cleanId },
          { rfqNo: cleanId }
        ]
      });
    }

    // Fallback: check other models
    if (!pr) {
      let NPPRequest = null;
      try { NPPRequest = require('../models/nppRequest.model'); } catch (e) {}
      if (NPPRequest) {
        pr = await NPPRequest.findOne({
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24 ? cleanId : null },
            { uniqueSerialNo: cleanId },
            { prNumber: cleanId },
            { serialNo: cleanId },
            { rfqNo: cleanId }
          ].filter(Boolean)
        });
      }
    }

    if (!pr) {
      return res.status(404).json({ success: false, message: "PR not found" });
    }

    let approvers = pr.approvalChain || pr.stakeholders || pr.formData?.approvalChain || [];
    const nowFormatted = new Date().toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    let target = approvers.find(s =>
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase())
    );

    if (!target || target.status === 'Approved') {
      const isSenior = ['admin', 'purchase head', 'head - purchase', 'vp', 'vp-operation', 'engineer', 'manager'].some(r => userRole.includes(r));
      if (isSenior) {
        target = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
      }
    }

    if (target) {
      target.status = 'Approved';
      target.dateTime = nowFormatted;
      target.remarks = comments || target.remarks || 'Approved';
      target.approvedBy = userName;
    }

    const remainingPending = approvers.filter(s => (s.status || 'Pending').toLowerCase() === 'pending');
    if (remainingPending.length === 0 || approvers.length === 0) {
      pr.status = 'Approved';
      pr.approvedAt = new Date();
      pr.approvedBy = userName;
      if (comments) pr.approvalComments = comments;
    } else {
      pr.status = 'Pending';
    }

    pr.approvalChain = approvers;
    pr.stakeholders = approvers;
    if (pr.formData) {
      pr.formData.approvalChain = approvers;
      pr.formData.stakeholders = approvers;
      pr.formData.status = pr.status;
    }
    pr.updatedAt = new Date();
    await pr.save();

    await notifyPr(pr, 'approved', comments || '');
    return res.json({
      success: true,
      message: pr.status === 'Approved' ? 'PR fully Approved and moved to PO stage!' : `Approved by ${userName}. Remaining pending: ${remainingPending.length}`,
      data: pr
    });
  } catch (err) {
    console.error('Error approving PR NPP:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const handleRejectPr = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Rejecter';
    const userEmail = (req.user?.email || '').toLowerCase().trim();

    let pr = null;
    const cleanId = String(id || '').trim();
    if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
      pr = await PrNpp.findById(cleanId);
    }
    if (!pr) {
      pr = await PrNpp.findOne({
        $or: [
          { uniqueSerialNo: cleanId },
          { prNumber: cleanId },
          { serialNo: cleanId },
          { rfqNo: cleanId }
        ]
      });
    }

    if (!pr) {
      return res.status(404).json({ success: false, message: "PR not found" });
    }

    pr.status = 'Rejected';
    pr.rejectedAt = new Date();
    pr.rejectionComments = comments || 'Rejected';
    pr.rejectedBy = userName;
    pr.updatedAt = new Date();

    await pr.save();
    await notifyPr(pr, 'rejected', comments || '');
    return res.json({ success: true, message: "PR rejected successfully", data: pr });
  } catch (err) {
    console.error('Error rejecting PR NPP:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

router.patch('/:id/approve', handleApprovePr);
router.post('/:id/approve', handleApprovePr);
router.patch('/:id/reject', handleRejectPr);
router.post('/:id/reject', handleRejectPr);

module.exports = router;
