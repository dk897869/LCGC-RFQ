const PrNpp = require('../models/prNpp.model');
const { sendMail } = require('../services/mail.service');
const { generateBeautifulPDF } = require('../services/pdf.service');

// Generate serial number
const generatePRSerial = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PR-${year}${month}${day}${hours}${minutes}${seconds}-${random}`;
};

// Create PR NPP
const createPrNpp = async (req, res) => {
  try {
    console.log("📥 Creating PR NPP...");
    
    const {
      requesterName, department, emailId, requestDate, contactNo, organization,
      titleOfActivity, purposeAndObjective, vendor, amount, remarks, priority,
      items, stakeholders, ccList, attachments, source, status
    } = req.body;

    if (!requesterName) return res.status(400).json({ success: false, message: "Requester name is required" });
    if (!emailId) return res.status(400).json({ success: false, message: "Email ID is required" });

    // Generate unique serial number
    const uniqueSerialNo = generatePRSerial();
    console.log(`📋 PR Serial: ${uniqueSerialNo}`);

    const newPr = new PrNpp({
      uniqueSerialNo, requesterName, department, emailId,
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      contactNo: contactNo || '', organization: organization || 'Radiant Appliances',
      titleOfActivity: titleOfActivity || '', purposeAndObjective: purposeAndObjective || '',
      vendor: vendor || '', amount: amount || 0, remarks: remarks || '',
      priority: priority || 'M', items: items || [], stakeholders: stakeholders || [],
      ccList: ccList || [], attachments: attachments || [],
      source: source || 'PR-REQUEST-NPP', status: status || 'Pending'
    });

    const savedPr = await newPr.save();
    console.log("✅ PR saved:", savedPr._id);

    // ==================== SEND ONE EMAIL TO ALL ====================
    console.log("📧 Sending email...");
    
    // Collect all recipients
    const toEmail = savedPr.emailId;
    const allCcEmails = [...new Set([
      ...(savedPr.ccList || []),
      ...((savedPr.stakeholders || []).map(s => s.email).filter(Boolean))
    ])];
    
    console.log(`📧 TO: ${toEmail}`);
    console.log(`📧 CC: ${allCcEmails.join(', ') || 'None'}`);
    
    // Generate PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(savedPr);
      if (pdfBuffer) console.log('📄 PDF generated');
    } catch (err) {
      console.error('PDF error:', err.message);
    }
    
    const attachments_pdf = pdfBuffer ? [{
      filename: `PR_${savedPr.uniqueSerialNo}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    const emailResult = await sendMail({
      to: toEmail,
      cc: allCcEmails,
      subject: `📋 New PR Created: ${savedPr.titleOfActivity || 'PR Request'} (${savedPr.uniqueSerialNo})`,
      prRequestData: savedPr,
      action: 'created',
      actor: null,
      nextApprover: null,
      attachments: attachments_pdf
    });
    
    console.log("📧 Email result:", emailResult);
    // ==================== END EMAIL ====================

    res.status(201).json({
      success: true,
      message: 'PR NPP created successfully',
      serialNumber: savedPr.uniqueSerialNo,
      data: savedPr
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all PR NPP
const listPrNpp = async (req, res) => {
  try {
    const rows = await PrNpp.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single PR NPP
const getPrNpp = async (req, res) => {
  try {
    const row = await PrNpp.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update PR NPP
const updatePrNpp = async (req, res) => {
  try {
    const updated = await PrNpp.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete PR NPP
const deletePrNpp = async (req, res) => {
  try {
    const deleted = await PrNpp.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "PR NPP not found" });
    res.json({ success: true, message: "PR NPP deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve PR NPP
const approvePrNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Approver';
    
    const pr = await PrNpp.findById(id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    
    pr.status = 'Approved';
    pr.approvedAt = new Date();
    pr.approvedBy = userName;
    pr.approvalComments = comments;
    await pr.save();
    
    // Send approval email
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(pr);
    } catch (err) { console.error('PDF error:', err.message); }
    
    const attachments_pdf = pdfBuffer ? [{
      filename: `PR_${pr.uniqueSerialNo}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    const allCcEmails = [...new Set([...(pr.ccList || []), ...((pr.stakeholders || []).map(s => s.email).filter(Boolean))])];
    
    await sendMail({
      to: pr.emailId,
      cc: allCcEmails,
      subject: `✅ PR Approved: ${pr.titleOfActivity} (${pr.uniqueSerialNo})`,
      prRequestData: pr,
      action: 'approved',
      actor: { name: userName, remarks: comments },
      attachments: attachments_pdf
    });
    
    res.json({ success: true, message: "PR NPP approved", data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reject PR NPP
const rejectPrNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Rejecter';
    
    const pr = await PrNpp.findById(id);
    if (!pr) return res.status(404).json({ success: false, message: "PR NPP not found" });
    
    pr.status = 'Rejected';
    pr.rejectedAt = new Date();
    pr.rejectedBy = userName;
    pr.rejectionComments = comments;
    await pr.save();
    
    // Send rejection email
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(pr);
    } catch (err) { console.error('PDF error:', err.message); }
    
    const attachments_pdf = pdfBuffer ? [{
      filename: `PR_${pr.uniqueSerialNo}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    const allCcEmails = [...new Set([...(pr.ccList || []), ...((pr.stakeholders || []).map(s => s.email).filter(Boolean))])];
    
    await sendMail({
      to: pr.emailId,
      cc: allCcEmails,
      subject: `❌ PR Rejected: ${pr.titleOfActivity} (${pr.uniqueSerialNo})`,
      prRequestData: pr,
      action: 'rejected',
      actor: { name: userName, remarks: comments },
      attachments: attachments_pdf
    });
    
    res.json({ success: true, message: "PR NPP rejected", data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPrNpp, listPrNpp, getPrNpp, updatePrNpp, deletePrNpp, approvePrNpp, rejectPrNpp
};