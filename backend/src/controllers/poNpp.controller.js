const PoNpp = require('../models/poNpp.model');
const PrNpp = require('../models/prNpp.model');
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
  
  // Create database notifications for all recipients
  try {
    const { createNotification } = require('../services/notification.service');
    const title = `PO Request ${actionText}`;
    const msg = `PO request ${poData.uniqueSerialNo || ''} (${poData.titleOfActivity || 'Purchase Order'}) has been ${action}.`;
    const type = action === 'created' ? 'pending' : action;
    for (const email of uniqueRecipients) {
      await createNotification(email, title, msg, type);
    }
  } catch (err) {
    console.error('⚠️ Error in sendPOEmail database notifications:', err.message);
  }

  // Send ONE email to everyone
  return await sendMail({
    to: toEmail,
    cc: ccEmailList,
    subject: subject,
    type: 'po',
    data: poData,
    action: action,
    comments: actor?.remarks || '',
    attachments: attachments
  });
};

// Create PO NPP
const createPoNpp = async (req, res) => {
  try {
    console.log("📥 Received PO NPP data:", JSON.stringify(req.body, null, 2));
    
    const {
      requesterName, name, department, emailId, email, requestDate, contactNo, organization,
      titleOfActivity, purposeAndObjective, amount, totalValue, remarks, priority,
      vendorCode, vendorName, vendorAddress, vendorGst, vendorContact, vendorEmail, vendorKindAttn,
      orderNo, orderDate, quotRef, prNo, prDate, purchaser, purchaserMobile,
      billingAddress, billingGst, shippingAddress, shippingGst,
      transporter, taxes, items, stakeholders, approvalChain, ccList, ccEmails, terms, financeRows, deliverySchedule,
      source, status, attachments
    } = req.body;

    const rName = requesterName || name || purchaser || req.user?.name || 'Requester';
    const rEmail = emailId || email || req.user?.email || '';

    // Generate unique serial number if not present
    let uniqueSerialNo = req.body.uniqueSerialNo;
    if (!uniqueSerialNo) {
      uniqueSerialNo = generatePOSerial();
    }
    console.log(`📋 PO Serial Number: ${uniqueSerialNo}`);

    let poStakeholders = approvalChain || stakeholders || [];
    if ((!poStakeholders || !poStakeholders.length) && prNo) {
      console.log(`🔍 Looking up stakeholders for associated PR: ${prNo}`);
      try {
        const associatedPr = await PrNpp.findOne({
          $or: [
            { uniqueSerialNo: prNo },
            { rfqNo: prNo },
            { titleOfActivity: prNo }
          ]
        });
        if (associatedPr && associatedPr.approvalChain && associatedPr.approvalChain.length) {
          poStakeholders = associatedPr.approvalChain;
          console.log(`✅ Loaded ${poStakeholders.length} approvers from PR NPP`);
        }
      } catch (dbErr) {
        console.error('Failed to lookup associated PR:', dbErr.message);
      }
    }

    const formattedStakeholders = (poStakeholders || []).map((s, i) => ({
      line: s.line || 'Parallel',
      managerName: s.managerName || s.stakeholder || s.name || `Approver ${i+1}`,
      stakeholder: s.stakeholder || s.managerName || s.name || `Approver ${i+1}`,
      name: s.name || s.managerName || s.stakeholder || `Approver ${i+1}`,
      email: s.email || '',
      designation: s.designation || s.role || '',
      role: s.role || s.designation || '',
      status: s.status || 'Pending',
      remarks: s.remarks || s.comments || '',
      comments: s.comments || s.remarks || '',
      contactNo: s.contactNo || '',
      organization: s.organization || '',
      dateTime: s.dateTime || s.date || ''
    }));

    const formattedItems = (items || []).map(item => ({
      partCode: item.partCode || item.partNo || item.itemCode || '',
      partNo: item.partNo || item.partCode || item.itemCode || '',
      itemDescription: item.itemDescription || item.description || item.partDescription || '',
      partDescription: item.partDescription || item.itemDescription || item.description || '',
      specification: item.specification || item.cndt || item.specs || '',
      hsnCode: item.hsnCode || item.hsn || '',
      hsn: item.hsn || item.hsnCode || '',
      uom: item.uom || 'Pcs',
      qty: Number(item.quantity || item.qty || 1),
      quantity: Number(item.quantity || item.qty || 1),
      unitPrice: Number(item.rate || item.unitPrice || 0),
      rate: Number(item.rate || item.unitPrice || 0),
      discount: Number(item.discount || 0),
      gst: Number(item.gst || 18),
      deliveryDate: item.deliveryDate || '',
      remark: item.remark || ''
    }));

    const newPo = new PoNpp({
      uniqueSerialNo,
      requesterName: rName,
      name: rName,
      department: department || 'Purchase',
      emailId: rEmail,
      email: rEmail,
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      contactNo: contactNo || '',
      organization: organization || 'Radiant Appliances',
      titleOfActivity: titleOfActivity || purposeAndObjective?.substring(0, 100) || `PO - ${vendorName || 'Order'}`,
      purposeAndObjective: purposeAndObjective || '',
      amount: amount || totalValue || 0,
      totalValue: amount || totalValue || 0,
      remarks: remarks || '',
      priority: priority || 'M',
      vendorCode: vendorCode || '',
      vendorName: vendorName || 'Vendor',
      vendorAddress: vendorAddress || '',
      vendorGst: vendorGst || '',
      vendorContact: vendorContact || '',
      vendorEmail: vendorEmail || '',
      vendorKindAttn: vendorKindAttn || '',
      orderNo: orderNo || uniqueSerialNo,
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      quotRef: quotRef || '',
      prNo: prNo || '',
      prDate: prDate || '',
      purchaser: purchaser || rName,
      purchaserMobile: purchaserMobile || '',
      billingAddress: billingAddress || '',
      billingGst: billingGst || '',
      shippingAddress: shippingAddress || '',
      shippingGst: shippingGst || '',
      transporter: transporter || '',
      taxes: taxes || '',
      items: formattedItems,
      stakeholders: formattedStakeholders,
      approvalChain: formattedStakeholders,
      ccList: ccList || ccEmails || [],
      ccEmails: ccEmails || ccList || [],
      terms: terms || [],
      financeRows: financeRows || [],
      deliverySchedule: deliverySchedule || [],
      attachments: attachments || [],
      source: source || 'PO-NPP',
      status: status || 'Pending',
      formData: req.body
    });

    const savedPo = await newPo.save();
    console.log("✅ PO NPP saved successfully:", savedPo._id, savedPo.uniqueSerialNo);

    // Send email asynchronously
    try {
      sendPOEmail(savedPo, 'created', null).catch(e => console.error('PO Email error:', e.message));
    } catch (emailErr) {}

    return res.status(201).json({
      success: true,
      message: 'Purchase Order submitted successfully',
      serialNumber: savedPo.uniqueSerialNo,
      data: savedPo
    });
  } catch (err) {
    console.error("❌ Error in createPoNpp:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get all PO NPP
const listPoNpp = async (req, res) => {
  try {
    const rows = await PoNpp.find().sort({ createdAt: -1 }).limit(200);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get single PO NPP
const getPoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    let row = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      row = await PoNpp.findById(id);
    }
    if (!row) {
      row = await PoNpp.findOne({ $or: [{ uniqueSerialNo: id }, { orderNo: id }] });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update PO NPP
const updatePoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ uniqueSerialNo: id }, { orderNo: id }] };
    }
    const updated = await PoNpp.findOneAndUpdate(
      query,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete PO NPP
const deletePoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { _id: id };
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ uniqueSerialNo: id }, { orderNo: id }] };
    }
    const deleted = await PoNpp.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    return res.json({ success: true, message: "PO NPP deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Approve PO NPP (Multi-level Approver Check)
const approvePoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Approver';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const userRole = (req.user?.role || req.user?.designation || '').toLowerCase().trim();
    
    let po = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      po = await PoNpp.findById(id);
    }
    if (!po) {
      po = await PoNpp.findOne({ $or: [{ uniqueSerialNo: id }, { orderNo: id }] });
    }
    
    if (!po) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    
    let approvers = po.approvalChain || po.stakeholders || [];
    approvers = approvers.map((a, i) => ({
      line: a.line || 'Parallel',
      managerName: a.managerName || a.stakeholder || a.name || `Approver ${i+1}`,
      stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
      name: a.name || a.managerName || a.stakeholder || `Approver ${i+1}`,
      comments: a.comments || a.remarks || '',
      remarks: a.remarks || a.comments || '',
      designation: a.designation || a.role || '',
      role: a.role || a.designation || '',
      status: a.status || 'Pending',
      dateTime: a.dateTime || a.date || '',
      email: a.email || '',
      contactNo: a.contactNo || '',
      organization: a.organization || ''
    }));

    let target = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.name && s.name.toLowerCase().trim() === userName.toLowerCase())
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
      target.comments = comments || target.comments || 'Approved';
      target.approvedBy = userName;
    }

    const remainingPending = approvers.filter(s => (s.status || 'Pending').toLowerCase() === 'pending');

    if (remainingPending.length === 0) {
      po.status = 'Approved';
      po.approvedAt = new Date();
      po.approvedBy = userName;
      if (comments) po.approvalComments = comments;
    } else {
      po.status = 'Pending';
    }

    po.stakeholders = approvers;
    po.approvalChain = approvers;
    if (po.formData) {
      po.formData.approvalChain = approvers;
      po.formData.stakeholders = approvers;
      po.formData.status = po.status;
      if (po.markModified) po.markModified('formData');
    }
    await po.save();
    
    // Send approval email asynchronously
    try {
      sendPOEmail(po, 'approved', { name: userName, remarks: comments }).catch(e => console.error(e.message));
    } catch (mailErr) {}
    
    return res.json({ 
      success: true, 
      message: remainingPending.length === 0 ? 'PO NPP fully Approved!' : `Approved by ${userName}. Remaining pending approvers: ${remainingPending.length}`, 
      data: po 
    });
  } catch (err) {
    console.error("❌ Error in approvePoNpp:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Reject PO NPP
const rejectPoNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body || {};
    const userName = req.user?.name || 'Rejecter';
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    
    let po = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      po = await PoNpp.findById(id);
    }
    if (!po) {
      po = await PoNpp.findOne({ $or: [{ uniqueSerialNo: id }, { orderNo: id }] });
    }
    
    if (!po) {
      return res.status(404).json({ success: false, message: "PO NPP not found" });
    }
    
    let approvers = po.approvalChain || po.stakeholders || [];
    approvers = approvers.map((a, i) => ({
      line: a.line || 'Parallel',
      managerName: a.managerName || a.stakeholder || a.name || `Approver ${i+1}`,
      stakeholder: a.stakeholder || a.managerName || a.name || `Approver ${i+1}`,
      name: a.name || a.managerName || a.stakeholder || `Approver ${i+1}`,
      comments: a.comments || a.remarks || '',
      remarks: a.remarks || a.comments || '',
      designation: a.designation || a.role || '',
      role: a.role || a.designation || '',
      status: a.status || 'Pending',
      dateTime: a.dateTime || a.date || '',
      email: a.email || '',
      contactNo: a.contactNo || '',
      organization: a.organization || ''
    }));

    let target = approvers.find(s => 
      (s.email && s.email.toLowerCase().trim() === userEmail) ||
      (s.stakeholder && s.stakeholder.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.managerName && s.managerName.toLowerCase().trim() === userName.toLowerCase()) ||
      (s.name && s.name.toLowerCase().trim() === userName.toLowerCase())
    );

    if (!target) {
      target = approvers.find(s => (s.status || 'Pending').toLowerCase() === 'pending');
    }

    const nowFormatted = new Date().toLocaleString('en-US', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    if (target) {
      target.status = 'Rejected';
      target.dateTime = nowFormatted;
      target.remarks = comments || 'Rejected';
      target.comments = comments || 'Rejected';
      target.rejectedBy = userName;
    }

    po.status = 'Rejected';
    po.rejectedAt = new Date();
    po.rejectedBy = userName;
    po.rejectionComments = comments || 'Rejected';
    po.rejectionReason = comments || 'Rejected';
    po.stakeholders = approvers;
    po.approvalChain = approvers;
    if (po.formData) {
      po.formData.approvalChain = approvers;
      po.formData.stakeholders = approvers;
      po.formData.status = 'Rejected';
      if (po.markModified) po.markModified('formData');
    }
    await po.save();
    
    // Send rejection email asynchronously
    try {
      sendPOEmail(po, 'rejected', { name: userName, remarks: comments }).catch(e => console.error(e.message));
    } catch (mailErr) {}
    
    return res.json({ success: true, message: "PO NPP rejected successfully", data: po });
  } catch (err) {
    console.error("❌ Error in rejectPoNpp:", err);
    return res.status(500).json({ success: false, message: err.message });
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