const RFQ = require('../models/Rfq');
const { sendMail } = require('../services/mail.service');
const { generateBeautifulPDF } = require('../services/pdf.service');

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

// Send RFQ Created Email with PDF
const sendRFQCreatedEmail = async (rfqData) => {
  const subject = `📋 New RFQ Created: ${rfqData.titleOfActivity} (${rfqData.uniqueSerialNo})`;
  
  console.log(`📧 Sending RFQ creation email to: ${rfqData.emailId}`);
  console.log(`📧 CC recipients: ${rfqData.ccTo?.join(', ') || 'None'}`);
  
  // Generate PDF
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(rfqData);
    console.log('📄 PDF generated successfully');
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  // Send to requester with CC
  const attachments = pdfBuffer ? [{
    filename: `RFQ_${rfqData.uniqueSerialNo}.pdf`,
    content: pdfBuffer.toString('base64'),
    contentType: 'application/pdf'
  }] : [];
  
  await sendMail({
    to: rfqData.emailId,
    cc: rfqData.ccTo || [],
    subject: subject,
    rfqData: rfqData,
    action: 'created',
    actor: null,
    nextApprover: rfqData.stakeholders?.[0] || null,
    attachments: attachments
  });
  
  // Send to all stakeholders (approvers)
  if (rfqData.stakeholders && rfqData.stakeholders.length > 0) {
    for (const approver of rfqData.stakeholders) {
      if (approver.email && approver.email !== rfqData.emailId) {
        await sendMail({
          to: approver.email,
          subject: `🔔 Approval Required: ${rfqData.titleOfActivity} (${rfqData.uniqueSerialNo})`,
          rfqData: rfqData,
          action: 'approval_needed',
          actor: { name: rfqData.requesterName },
          nextApprover: null,
          attachments: attachments
        });
        console.log(`📧 Approval request sent to: ${approver.email}`);
      }
    }
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
        remarks: s.remarks || ''
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
      status: 'Pending'
    };

    const newRFQ = new RFQ(rfqData);
    const savedRFQ = await newRFQ.save();

    console.log("✅ RFQ saved successfully:", savedRFQ._id);
    console.log(`📋 RFQ Serial Number: ${savedRFQ.uniqueSerialNo}`);

    // Send emails with PDF attachment
    try {
      await sendRFQCreatedEmail(savedRFQ);
      console.log("📧 RFQ creation emails sent successfully");
    } catch (emailErr) {
      console.error('⚠️ Email sending error:', emailErr.message);
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
      req.body,
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
    
    rfq.status = 'Approved';
    if (comments) {
      rfq.approvalComments = comments;
    }
    rfq.approvedAt = new Date();
    rfq.approvedBy = userName;
    
    await rfq.save();
    
    // Send approval email with PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(rfq);
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr.message);
    }
    
    const attachments = pdfBuffer ? [{
      filename: `RFQ_${rfq.uniqueSerialNo}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    await sendMail({
      to: rfq.emailId,
      cc: rfq.ccTo || [],
      subject: `✅ RFQ Approved: ${rfq.titleOfActivity} (${rfq.uniqueSerialNo})`,
      rfqData: rfq,
      action: 'approved',
      actor: { name: userName, remarks: comments },
      nextApprover: null,
      attachments: attachments
    });
    
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
    
    rfq.status = 'Rejected';
    if (comments) {
      rfq.rejectionComments = comments;
    }
    rfq.rejectedAt = new Date();
    rfq.rejectedBy = userName;
    
    await rfq.save();
    
    // Send rejection email with PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(rfq);
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr.message);
    }
    
    const attachments = pdfBuffer ? [{
      filename: `RFQ_${rfq.uniqueSerialNo}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    await sendMail({
      to: rfq.emailId,
      cc: rfq.ccTo || [],
      subject: `❌ RFQ Rejected: ${rfq.titleOfActivity} (${rfq.uniqueSerialNo})`,
      rfqData: rfq,
      action: 'rejected',
      actor: { name: userName, remarks: comments },
      nextApprover: null,
      attachments: attachments
    });
    
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
      'Purchase', 'Production', 'Quality', 'Logistics', 'Maintenance', 'HR', 'Stores', 'IT', 'Finance', 'R&D', 'Operations', 'Sales'
    ]
  });
};

module.exports = {
  getAllRFQs,
  createRFQ,
  getRFQById,
  updateRFQ,
  deleteRFQ,
  approveRFQ,
  rejectRFQ,
  getVendors,
  getDepartments
};