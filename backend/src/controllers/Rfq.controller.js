const RFQ = require('../models/Rfq');
const { sendMail } = require('../services/mail.service');
const { createNotification } = require('../services/notification.service');

// Generate unique serial number
const generateSerialNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RFQ-${year}${month}${day}${hours}${minutes}${seconds}-${random}`;
};

// Send RFQ Created Email (Non-blocking)
const sendRFQCreatedEmail = async (rfqData) => {
  try {
    const subject = `📋 New RFQ Created: ${rfqData.titleOfActivity} (${rfqData.uniqueSerialNo})`;
    
    console.log(`📧 Sending RFQ creation email to: ${rfqData.emailId}`);
    console.log(`📧 CC recipients: ${rfqData.ccTo?.join(', ') || 'None'}`);
    
    await sendMail({
      to: rfqData.emailId,
      cc: rfqData.ccTo || [],
      subject: subject,
      html: `
        <h2>RFQ Created Successfully</h2>
        <p><strong>Serial Number:</strong> ${rfqData.uniqueSerialNo}</p>
        <p><strong>Title:</strong> ${rfqData.titleOfActivity}</p>
        <p><strong>Status:</strong> Pending Approval</p>
        <p>Your RFQ has been submitted for approval. You will be notified once it is processed.</p>
      `
    });
    
    if (rfqData.stakeholders && rfqData.stakeholders.length > 0) {
      for (const approver of rfqData.stakeholders) {
        if (approver.email && approver.email !== rfqData.emailId) {
          await sendMail({
            to: approver.email,
            subject: `🔔 Approval Required: ${rfqData.titleOfActivity} (${rfqData.uniqueSerialNo})`,
            html: `
              <h2>RFQ Approval Required</h2>
              <p><strong>Requester:</strong> ${rfqData.requesterName}</p>
              <p><strong>Title:</strong> ${rfqData.titleOfActivity}</p>
              <p><strong>Serial Number:</strong> ${rfqData.uniqueSerialNo}</p>
              <p>Please login to review and approve this RFQ.</p>
            `
          });
          console.log(`📧 Approval request sent to: ${approver.email}`);
        }
      }
    }
  } catch (error) {
    console.error('⚠️ Email sending error (non-blocking):', error.message);
  }
};

// Get all RFQs
const getAllRFQs = async (req, res) => {
  try {
    const rfqs = await RFQ.find().select('-items.picturePreview -attachments').sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ 
      success: true, 
      count: rfqs.length,
      data: rfqs 
    });
  } catch (err) {
    console.error("Error in getAllRFQs:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch RFQs",
      error: err.message 
    });
  }
};

// Create new RFQ
const createRFQ = async (req, res) => {
  try {
    console.log("📥 Received RFQ data:", JSON.stringify(req.body, null, 2));

    let { 
      titleOfActivity, 
      items, 
      requesterName,
      department,
      emailId,
      contactNo,
      requestDate,
      organization,
      priority,
      purposeAndObjective,
      ccTo,
      stakeholders
    } = req.body;

    if (!titleOfActivity) {
      return res.status(400).json({
        success: false,
        message: "titleOfActivity is required"
      });
    }

    if (!requesterName) {
      return res.status(400).json({
        success: false,
        message: "requesterName is required"
      });
    }

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: "emailId is required"
      });
    }

    let processedItems = [];
    if (items && Array.isArray(items)) {
      processedItems = items.map(item => ({
        partNo: item.partNo || '',
        itemDescription: item.itemDescription || item.description || '',
        specification: item.specification || '',
        commodity: item.commodity || '',
        uom: item.uom || 'Pcs',
        quantity: item.quantity || item.qty || 1,
        make: item.make || '',
        alternativeSimilar: item.alternativeSimilar || item.altSimilar || '',
        pictureExistingVendorReference: item.pictureExistingVendorReference || item.vendorRef || '',
        remark: item.remark || '',
        pictureName: item.pictureName || '',
        picturePreview: item.picturePreview || ''
      })).filter(item => item.itemDescription);
    }

    if (processedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid item is required"
      });
    }

    let processedStakeholders = [];
    if (stakeholders && Array.isArray(stakeholders)) {
      processedStakeholders = stakeholders.map(s => ({
        line: s.line || 'Parallel',
        managerName: s.managerName || s.name || '',
        email: s.email || '',
        designation: s.designation || '',
        status: 'Pending',
        remarks: s.remarks || '',
        dateTime: null
      })).filter(s => s.managerName || s.email);
    }

    const uniqueSerialNo = generateSerialNumber();
    console.log(`📋 Generated RFQ Serial Number: ${uniqueSerialNo}`);

    const rfqData = {
      uniqueSerialNo: uniqueSerialNo,
      requesterName: requesterName,
      department: department || 'Purchase',
      emailId: emailId,
      contactNo: contactNo || '',
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      organization: organization || 'Radiant Appliances',
      titleOfActivity: titleOfActivity,
      purposeAndObjective: purposeAndObjective || '',
      priority: priority === 'High' ? 'H' : priority === 'Low' ? 'L' : 'M',
      items: processedItems,
      stakeholders: processedStakeholders,
      ccTo: ccTo || [],
      status: 'Pending',
      currentStage: 'RFQ',
      vendorRequestCreated: false,
      quotationCompleted: false,
      approvalDate: null,
      approvedBy: null,
      createdBy: req.user?.id
    };

    const newRFQ = new RFQ(rfqData);
    const savedRFQ = await newRFQ.save();

     console.log("✅ RFQ saved successfully:", savedRFQ._id);

    // Create database notification for creator
    await createNotification(
      savedRFQ.emailId,
      'RFQ Submitted',
      `Your RFQ ${savedRFQ.uniqueSerialNo} has been submitted for approval.`,
      'pending'
    );

    // Create database notification for stakeholders
    if (savedRFQ.stakeholders && savedRFQ.stakeholders.length > 0) {
      for (const approver of savedRFQ.stakeholders) {
        if (approver.email) {
          await createNotification(
            approver.email,
            'RFQ Approval Required',
            `RFQ ${savedRFQ.uniqueSerialNo} (${savedRFQ.titleOfActivity}) requires your approval.`,
            'pending'
          );
        }
      }
    }

    try {
      await sendRFQCreatedEmail(savedRFQ);
      console.log("📧 RFQ creation emails sent successfully");
    } catch (emailErr) {
      console.error('⚠️ Email sending error (non-blocking):', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'RFQ created successfully',
      serialNumber: savedRFQ.uniqueSerialNo,
      data: savedRFQ
    });
  } catch (err) {
    console.error("❌ Error in createRFQ:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message || "Failed to create RFQ"
    });
  }
};

// Get single RFQ by ID
const getRFQById = async (req, res) => {
  try {
    const rfq = await RFQ.findById(req.params.id);
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: rfq 
    });
  } catch (err) {
    console.error("Error in getRFQById:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch RFQ",
      error: err.message 
    });
  }
};

// Update RFQ
const updateRFQ = async (req, res) => {
  try {
    const rfq = await RFQ.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'RFQ updated successfully',
      data: rfq 
    });
  } catch (err) {
    console.error("Error in updateRFQ:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Delete RFQ
const deleteRFQ = async (req, res) => {
  try {
    const rfq = await RFQ.findByIdAndDelete(req.params.id);
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'RFQ deleted successfully' 
    });
  } catch (err) {
    console.error("Error in deleteRFQ:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Approve RFQ
const approveRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Approver';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const userRole = (req.user?.role || req.user?.designation || '').toLowerCase().trim();
    
    let rfq = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      rfq = await RFQ.findById(id);
    }
    if (!rfq) {
      rfq = await RFQ.findOne({ $or: [{ uniqueSerialNo: id }, { rfqNo: id }] });
    }
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }

    let approvers = rfq.stakeholders || [];
    let target = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.name && s.name.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase())
    );

    if (!target || target.status === 'Approved') {
      const isSenior = ['admin', 'purchase head', 'head - purchase', 'vp', 'vp-operation', 'engineer', 'manager'].some(r => userRole.includes(r));
      if (isSenior) {
        target = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
      }
    }

    const nowFormatted = new Date().toLocaleString('en-US', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    if (target) {
      target.status = 'Approved';
      target.dateTime = nowFormatted;
      target.remarks = comments || target.remarks || 'Approved';
      target.approvedBy = userName;
    }

    // Check Parallel vs Sequential logic
    // If any parallel approver has approved, or if any approved approver is marked 'Parallel':
    const hasParallelApproval = approvers.some(s => 
      (s.line || 'Parallel').toLowerCase() === 'parallel' && 
      (s.status || '').toLowerCase() === 'approved'
    );
    const allApproved = approvers.length > 0 && approvers.every(s => (s.status || '').toLowerCase() === 'approved');

    if (hasParallelApproval || allApproved || !approvers.length) {
      rfq.status = 'Approved';
      rfq.approvalDate = new Date();
      rfq.approvedBy = userName;
      rfq.currentStage = 'Vendor Request';
      rfq.vendorRequestCreated = false;
      rfq.quotationCompleted = false;
    } else {
      rfq.status = 'In-Process';
    }

    if (comments) {
      rfq.approvalComments = comments;
    }
    rfq.updatedAt = new Date();
    await rfq.save();

    console.log(`✅ RFQ ${rfq.uniqueSerialNo} approved by ${userName}. Status: ${rfq.status}`);

    // Create database notification for creator
    try {
      await createNotification(
        rfq.emailId,
        `RFQ ${rfq.status}`,
        `Your RFQ ${rfq.uniqueSerialNo} has been ${rfq.status.toLowerCase()} by ${userName}.`,
        rfq.status === 'Approved' ? 'approved' : 'pending'
      );
    } catch (nErr) {}

    return res.status(200).json({ 
      success: true, 
      message: rfq.status === 'Approved' ? 'RFQ approved and moved to Requisition to Vendor!' : `Approved by ${userName}. Status: ${rfq.status}`, 
      data: rfq 
    });
  } catch (err) {
    console.error("Error in approveRFQ:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Reject RFQ
const rejectRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Rejecter';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    
    let rfq = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      rfq = await RFQ.findById(id);
    }
    if (!rfq) {
      rfq = await RFQ.findOne({ $or: [{ uniqueSerialNo: id }, { rfqNo: id }] });
    }
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }

    let approvers = rfq.stakeholders || [];
    let currentApprover = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.name && s.name.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase())
    );

    if (!currentApprover) {
      currentApprover = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
    }

    const nowFormatted = new Date().toLocaleString('en-US', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    if (currentApprover) {
      currentApprover.status = 'Rejected';
      currentApprover.dateTime = nowFormatted;
      currentApprover.remarks = comments || 'Rejected';
      currentApprover.rejectedBy = userName;
    }
    
    rfq.status = 'Rejected';
    rfq.rejectedBy = userName;
    rfq.rejectionReason = comments || 'Rejected';
    rfq.rejectedReason = comments || 'Rejected';
    rfq.rejectedDate = new Date();
    rfq.currentStage = 'Rejected';
    
    if (comments) {
      rfq.approvalComments = comments;
    }
    rfq.updatedAt = new Date();
    
    await rfq.save();

    console.log(`❌ RFQ ${rfq.uniqueSerialNo} rejected by ${userName}.`);

    // Create database notification for creator
    try {
      await createNotification(
        rfq.emailId,
        'RFQ Rejected',
        `Your RFQ ${rfq.uniqueSerialNo} has been rejected by ${userName}. Reason: ${comments || 'No reason provided'}`,
        'rejected'
      );
    } catch (nErr) {}
    
    return res.status(200).json({
      success: true,
      message: 'RFQ rejected successfully',
      data: rfq
    });
  } catch (err) {
    console.error("Error in rejectRFQ:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to reject RFQ'
    });
  }
};

// Get Approved RFQs (for vendor request)
const getApprovedRFQs = async (req, res) => {
  try {
    const rfqs = await RFQ.find({
      status: 'Approved',
      vendorRequestCreated: false,
      currentStage: { $ne: 'Rejected' }
    }).select('-items.picturePreview').sort({ approvalDate: -1 });

    console.log(`✅ Found ${rfqs.length} approved RFQs ready for vendor request`);

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: rfqs
    });
  } catch (err) {
    console.error("Error in getApprovedRFQs:", err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch approved RFQs'
    });
  }
};

// Get RFQs by vendor request status
const getRFQsByVendorStatus = async (req, res) => {
  try {
    const { vendorRequestCreated } = req.query;
    let filter = { status: 'Approved' };
    
    if (vendorRequestCreated === 'true') {
      filter.vendorRequestCreated = true;
    } else if (vendorRequestCreated === 'false') {
      filter.vendorRequestCreated = false;
    }

    const rfqs = await RFQ.find(filter).select('-items.picturePreview').sort({ approvalDate: -1 });

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: rfqs
    });
  } catch (err) {
    console.error("Error in getRFQsByVendorStatus:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get RFQ workflow status
const getRFQWorkflowStatus = async (req, res) => {
  try {
    const rfq = await RFQ.findById(req.params.id).select(
      'uniqueSerialNo status currentStage vendorRequestCreated quotationCompleted ' +
      'approvalDate approvedBy rejectedDate rejectedBy winnerVendorId winnerVendorName'
    );

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    res.status(200).json({
      success: true,
      data: rfq
    });
  } catch (err) {
    console.error("Error in getRFQWorkflowStatus:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get Vendors
const getVendors = (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: '1', name: 'Steel Corp Ltd', email: 'contact@steelcorp.com' },
      { id: '2', name: 'ElectroMart', email: 'sales@electromart.com' },
      { id: '3', name: 'PackPro', email: 'info@packpro.com' },
      { id: '4', name: 'Radiant Suppliers', email: 'purchase@radiantappliances.com' }
    ]
  });
};

// Get Departments
const getDepartments = (req, res) => {
  res.status(200).json({
    success: true,
    departments: [
      'Purchase', 'Production', 'Quality', 'Logistics', 'Maintenance', 
      'HR', 'Stores', 'IT', 'Finance', 'R&D', 'Operations', 'Sales'
    ]
  });
};

// Get RFQ by serial number
const getRFQBySerial = async (req, res) => {
  try {
    const serial = req.params.serialNumber;
    const rfq = await RFQ.findOne({
      $or: [
        { uniqueSerialNo: serial },
        { serialNo: serial },
        { rfqNo: serial }
      ]
    });
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    res.status(200).json({ success: true, data: rfq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllRFQs,
  createRFQ,
  getRFQById,
  getRFQBySerial,
  updateRFQ,
  deleteRFQ,
  approveRFQ,
  rejectRFQ,
  getVendors,
  getDepartments,
  getApprovedRFQs,
  getRFQsByVendorStatus,
  getRFQWorkflowStatus
};