const RFQ = require('../models/Rfq');
const { sendMail } = require('../services/mail.service');

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
    
    // Send to requester with CC
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
    
    // Send to all stakeholders (approvers)
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
    const rfqs = await RFQ.find().sort({ createdAt: -1 });
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

    // Validate required fields
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

    // Process items
    let processedItems = [];
    if (items && Array.isArray(items)) {
      processedItems = items.map(item => ({
        itemDescription: item.itemDescription || item.description || '',
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

    // Process stakeholders
    let processedStakeholders = [];
    if (stakeholders && Array.isArray(stakeholders)) {
      processedStakeholders = stakeholders.map(s => ({
        line: s.line || 'Parallel',
        managerName: s.managerName || '',
        email: s.email || '',
        designation: s.designation || '',
        status: 'Pending',
        remarks: s.remarks || '',
        dateTime: null
      })).filter(s => s.email);
    }

    // Generate unique serial number
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
      createdBy: req.user?.id,
      // RFQ Workflow fields
      currentStage: 'RFQ',
      vendorRequestCreated: false,
      quotationCompleted: false,
      approvalDate: null,
      approvedBy: null,
      rejectedBy: null,
      rejectedReason: null,
      rejectedDate: null,
      winnerVendorId: null,
      winnerVendorName: null,
      winnerPrice: null
    };

    const newRFQ = new RFQ(rfqData);
    const savedRFQ = await newRFQ.save();

    console.log("✅ RFQ saved successfully:", savedRFQ._id);
    console.log(`📋 RFQ Serial Number: ${savedRFQ.uniqueSerialNo}`);

    // Send emails (non-blocking)
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

    res.status(200).json({ 
      success: true, 
      message: 'RFQ deleted successfully' 
    });
  } catch (err) {
    console.error("Error in deleteRFQ:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Approve RFQ
const approveRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Approver';
    
    const rfq = await RFQ.findById(id);
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }
    
    // Update RFQ with approval
    rfq.status = 'Approved';
    rfq.approvalDate = new Date();
    rfq.approvedBy = userName;
    rfq.currentStage = 'Vendor Request';
    rfq.vendorRequestCreated = false;
    rfq.quotationCompleted = false;
    
    if (comments) {
      rfq.approvalComments = comments;
    }
    rfq.updatedAt = new Date();
    
    await rfq.save();
    
    // Send approval email (non-blocking)
    try {
      await sendMail({
        to: rfq.emailId,
        cc: rfq.ccTo || [],
        subject: `✅ RFQ Approved: ${rfq.titleOfActivity} (${rfq.uniqueSerialNo})`,
        html: `
          <h2>RFQ Approved</h2>
          <p><strong>Serial Number:</strong> ${rfq.uniqueSerialNo}</p>
          <p><strong>Title:</strong> ${rfq.titleOfActivity}</p>
          <p><strong>Status:</strong> Approved</p>
          <p><strong>Approved By:</strong> ${userName}</p>
          ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
          <p>The RFQ will now be sent to vendors for quotation.</p>
        `
      });
    } catch (emailErr) {
      console.error('⚠️ Approval email error (non-blocking):', emailErr.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'RFQ approved successfully',
      data: rfq
    });
  } catch (err) {
    console.error("Error in approveRFQ:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to approve RFQ'
    });
  }
};

// Reject RFQ
const rejectRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Rejecter';
    
    const rfq = await RFQ.findById(id);
    
    if (!rfq) {
      return res.status(404).json({ 
        success: false, 
        message: 'RFQ not found' 
      });
    }
    
    // Update RFQ with rejection
    rfq.status = 'Rejected';
    rfq.rejectedBy = userName;
    rfq.rejectedReason = comments || 'No reason provided';
    rfq.rejectedDate = new Date();
    rfq.currentStage = 'Rejected';
    
    if (comments) {
      rfq.rejectionComments = comments;
    }
    rfq.updatedAt = new Date();
    
    await rfq.save();
    
    // Send rejection email (non-blocking)
    try {
      await sendMail({
        to: rfq.emailId,
        cc: rfq.ccTo || [],
        subject: `❌ RFQ Rejected: ${rfq.titleOfActivity} (${rfq.uniqueSerialNo})`,
        html: `
          <h2>RFQ Rejected</h2>
          <p><strong>Serial Number:</strong> ${rfq.uniqueSerialNo}</p>
          <p><strong>Title:</strong> ${rfq.titleOfActivity}</p>
          <p><strong>Status:</strong> Rejected</p>
          <p><strong>Rejected By:</strong> ${userName}</p>
          ${comments ? `<p><strong>Reason:</strong> ${comments}</p>` : ''}
        `
      });
    } catch (emailErr) {
      console.error('⚠️ Rejection email error (non-blocking):', emailErr.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'RFQ rejected successfully',
      data: rfq
    });
  } catch (err) {
    console.error("Error in rejectRFQ:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to reject RFQ'
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

// Get approved RFQs for vendor request
const getApprovedRFQs = async (req, res) => {
  try {
    const rfqs = await RFQ.find({
      status: 'Approved',
      vendorRequestCreated: false,
      currentStage: { $ne: 'Rejected' }
    }).sort({ approvedDate: -1 });
    
    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: rfqs
    });
  } catch (err) {
    console.error("Error in getApprovedRFQs:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Update vendor request status for RFQ
const updateVendorRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorRequestCreated, currentStage } = req.body;
    
    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    
    if (vendorRequestCreated !== undefined) {
      rfq.vendorRequestCreated = vendorRequestCreated;
    }
    if (currentStage) {
      rfq.currentStage = currentStage;
    }
    
    await rfq.save();
    
    res.status(200).json({
      success: true,
      message: 'RFQ vendor request status updated',
      data: rfq
    });
  } catch (err) {
    console.error("Error in updateVendorRequestStatus:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Update quotation status for RFQ
const updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotationCompleted, currentStage } = req.body;
    
    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    
    if (quotationCompleted !== undefined) {
      rfq.quotationCompleted = quotationCompleted;
    }
    if (currentStage) {
      rfq.currentStage = currentStage;
    }
    
    await rfq.save();
    
    res.status(200).json({
      success: true,
      message: 'RFQ quotation status updated',
      data: rfq
    });
  } catch (err) {
    console.error("Error in updateQuotationStatus:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Select winner for RFQ
const selectWinner = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerVendorId, winnerVendorName, winnerPrice } = req.body;
    
    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    
    rfq.winnerVendorId = winnerVendorId;
    rfq.winnerVendorName = winnerVendorName;
    rfq.winnerPrice = winnerPrice;
    rfq.status = 'Vendor Finalized';
    rfq.currentStage = 'Completed';
    rfq.updatedAt = new Date();
    
    await rfq.save();
    
    res.status(200).json({
      success: true,
      message: 'Winner selected successfully',
      data: rfq
    });
  } catch (err) {
    console.error("Error in selectWinner:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
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
  updateVendorRequestStatus,
  updateQuotationStatus,
  selectWinner
};