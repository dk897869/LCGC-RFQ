const PoNpp = require('../models/poNpp.model');
const { sendMail } = require('../services/mail.service');
const { generateBeautifulPDF } = require('../services/pdf.service');
const { generatePOSerial } = require('../services/serialNumber.service');

// Send SINGLE PO Email (to all recipients at once)
const sendPOEmail = async (poData, action, actor) => {
  const actionText = {
    created: 'Created',
    approved: 'Approved',
    rejected: 'Rejected'
  }[action] || 'Created';
  
  const subject = `${action === 'created' ? '📋' : action === 'approved' ? '✅' : '❌'} PO ${actionText}: ${poData.orderNo || poData.titleOfActivity || 'Purchase Order'} (${poData.uniqueSerialNo})`;
  
  // Collect all unique recipients
  const requesterEmail = poData.emailId;
  const ccEmails = poData.ccList || [];
  const approverEmails = (poData.stakeholders || []).map(s => s.email).filter(Boolean);
  const vendorEmail = poData.vendorEmail ? [poData.vendorEmail] : [];
  
  // Combine all recipients
  const allRecipients = [requesterEmail, ...ccEmails, ...approverEmails, ...vendorEmail];
  const uniqueRecipients = [...new Set(allRecipients.filter(Boolean))];
  
  // First email is TO, rest are CC
  const toEmail = requesterEmail;
  const ccEmailList = uniqueRecipients.filter(email => email !== toEmail);
  
  console.log(`📧 Sending ONE PO email - TO: ${toEmail}`);
  console.log(`📧 CC: ${ccEmailList.join(', ')}`);
  
  // Generate PDF attachment
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(poData);
    console.log('📄 PDF generated successfully');
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  const attachments = pdfBuffer ? [{
    filename: `PO_${poData.uniqueSerialNo || poData._id || Date.now()}.pdf`,
    content: pdfBuffer.toString('base64'),
    contentType: 'application/pdf'
  }] : [];
  
  // Send ONE email to everyone
  return await sendMail({
    to: toEmail,
    cc: ccEmailList,
    subject: subject,
    poRequestData: poData,
    action: action,
    actor: actor || null,
    nextApprover: null,
    attachments: attachments
  });
};

// Create PO NPP
const createPoNpp = async (req, res) => {
  try {
    console.log("📥 Received PO NPP data:", JSON.stringify(req.body, null, 2));
    
    const {
      requesterName, department, emailId, requestDate, contactNo, organization,
      titleOfActivity, purposeAndObjective, amount, remarks, priority,
      vendorCode, vendorName, vendorAddress, vendorGst, vendorContact, vendorEmail, vendorKindAttn,
      orderNo, orderDate, quotRef, prNo, prDate, purchaser, purchaserMobile,
      billingAddress, billingGst, shippingAddress, shippingGst,
      transporter, taxes, items, stakeholders, ccList, terms, financeRows, deliverySchedule,
      source, status
    } = req.body;

    if (!requesterName) {
      return res.status(400).json({ success: false, message: "Requester name is required" });
    }

    // Generate unique serial number
    const uniqueSerialNo = generatePOSerial();
    console.log(`📋 Generated PO Serial Number: ${uniqueSerialNo}`);

    const newPo = new PoNpp({
      uniqueSerialNo,
      requesterName,
      department,
      emailId,
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      contactNo,
      organization: organization || 'Radiant Appliances',
      titleOfActivity: titleOfActivity || purposeAndObjective?.substring(0, 100) || '',
      purposeAndObjective,
      amount: amount || 0,
      remarks,
      priority: priority || 'M',
      vendorCode, vendorName, vendorAddress, vendorGst, vendorContact, vendorEmail, vendorKindAttn,
      orderNo: orderNo || `PO-${Date.now()}`,
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      quotRef, prNo, prDate, purchaser, purchaserMobile,
      billingAddress, billingGst, shippingAddress, shippingGst,
      transporter, taxes,
      items: items || [],
      stakeholders: stakeholders || [],
      ccList: ccList || [],
      terms: terms || [],
      financeRows: financeRows || [],
      deliverySchedule: deliverySchedule || [],
      source: source || 'PO-NPP',
      status: status || 'Pending'
    });

    const savedPo = await newPo.save();
    console.log("✅ PO NPP saved successfully:", savedPo._id);
    console.log(`📋 PO Serial Number: ${savedPo.uniqueSerialNo}`);

    // Send ONE email to all recipients
    try {
      await sendPOEmail(savedPo, 'created', null);
      console.log("📧 PO email sent successfully to all recipients");
    } catch (emailErr) {
      console.error('⚠️ Email sending error:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'PO NPP created successfully',
      serialNumber: savedPo.uniqueSerialNo,
      data: savedPo
    });
  } catch (err) {
    console.error("❌ Error in createPoNpp:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all PO NPP
const listPoNpp = async (req, res) => {
  try {
    const rows = await PoNpp.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single PO NPP
const getPoNpp = async (req, res) => {
  try {
    const row = await PoNpp.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update PO NPP
const updatePoNpp = async (req, res) => {
  try {
    const updated = await PoNpp.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete PO NPP
const deletePoNpp = async (req, res) => {
  try {
    const deleted = await PoNpp.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    res.json({ success: true, message: "PO NPP deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve PO NPP
const approvePoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Approver';
    
    const po = await PoNpp.findById(id);
    if (!po) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    
    if (po.stakeholders && po.stakeholders.length > 0) {
      const pendingApprover = po.stakeholders.find(s => s.status === 'Pending');
      if (pendingApprover) {
        pendingApprover.status = 'Approved';
        pendingApprover.remarks = comments;
        pendingApprover.dateTime = new Date().toISOString();
      }
      const remainingPending = po.stakeholders.filter(s => s.status === 'Pending');
      po.status = remainingPending.length === 0 ? 'Approved' : 'In-Process';
    } else {
      po.status = 'Approved';
    }
    
    po.approvedAt = new Date();
    po.approvedBy = userName;
    po.approvalComments = comments;
    await po.save();
    
    // Send approval email
    try {
      await sendPOEmail(po, 'approved', { name: userName, remarks: comments });
      console.log("📧 Approval email sent");
    } catch (emailErr) {
      console.error('Approval email error:', emailErr.message);
    }
    
    res.json({ success: true, message: "PO NPP approved", data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reject PO NPP
const rejectPoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Rejecter';
    
    const po = await PoNpp.findById(id);
    if (!po) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    
    if (po.stakeholders && po.stakeholders.length > 0) {
      const pendingApprover = po.stakeholders.find(s => s.status === 'Pending');
      if (pendingApprover) {
        pendingApprover.status = 'Rejected';
        pendingApprover.remarks = comments;
        pendingApprover.dateTime = new Date().toISOString();
      }
    }
    
    po.status = 'Rejected';
    po.rejectedAt = new Date();
    po.rejectedBy = userName;
    po.rejectionComments = comments;
    await po.save();
    
    // Send rejection email
    try {
      await sendPOEmail(po, 'rejected', { name: userName, remarks: comments });
      console.log("📧 Rejection email sent");
    } catch (emailErr) {
      console.error('Rejection email error:', emailErr.message);
    }
    
    res.json({ success: true, message: "PO NPP rejected", data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPoNpp,
  listPoNpp,
  getPoNpp,
  updatePoNpp,
  deletePoNpp,
  approvePoNpp,
  rejectPoNpp
};