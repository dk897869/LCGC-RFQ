const PaymentNpp = require('../models/paymentNpp.model');
const { sendMail } = require('../services/mail.service');
const { generateBeautifulPDF } = require('../services/pdf.service');
const { generatePaymentSerial } = require('../services/serialNumber.service');

// Send SINGLE Payment Email
const sendPaymentEmail = async (paymentData, action, actor) => {
  const actionText = {
    created: 'Created',
    approved: 'Approved',
    rejected: 'Rejected'
  }[action] || 'Created';
  
  const subject = `${action === 'created' ? '📋' : action === 'approved' ? '✅' : '❌'} Payment ${actionText}: ${paymentData.titleOfActivity || paymentData.paymentTo || 'Payment Request'} (${paymentData.uniqueSerialNo})`;
  
  // Collect all unique recipients
  const requesterEmail = paymentData.emailId;
  const ccEmails = paymentData.ccList || [];
  const approverEmails = (paymentData.stakeholders || []).map(s => s.email).filter(Boolean);
  
  const allRecipients = [requesterEmail, ...ccEmails, ...approverEmails];
  const uniqueRecipients = [...new Set(allRecipients.filter(Boolean))];
  
  const toEmail = requesterEmail;
  const ccEmailList = uniqueRecipients.filter(email => email !== toEmail);
  
  console.log(`📧 Sending ONE Payment email - TO: ${toEmail}`);
  console.log(`📧 CC: ${ccEmailList.join(', ')}`);
  
  // Generate PDF attachment
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(paymentData);
    console.log('📄 PDF generated successfully');
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  const attachments = pdfBuffer ? [{
    filename: `Payment_${paymentData.uniqueSerialNo || paymentData._id || Date.now()}.pdf`,
    content: pdfBuffer.toString('base64'),
    contentType: 'application/pdf'
  }] : [];
  
  return await sendMail({
    to: toEmail,
    cc: ccEmailList,
    subject: subject,
    paymentRequestData: paymentData,
    action: action,
    actor: actor || null,
    nextApprover: null,
    attachments: attachments
  });
};

// Create Payment NPP
const createPaymentNpp = async (req, res) => {
  try {
    console.log("📥 Received Payment NPP data:", JSON.stringify(req.body, null, 2));
    
    const {
      requesterName, department, emailId, requestDate, contactNo, organization,
      designation, paymentDueTo, level, paymentTo, purposeAndObjective,
      expenseType, expenseAmount, balanceForPayment, deduction, bankDetails,
      remarks, sapName, sapCode, titleOfActivity, amount,
      invoices, stakeholders, ccList, attachments, source, status
    } = req.body;

    if (!requesterName) {
      return res.status(400).json({ success: false, message: "Requester name is required" });
    }

    // Generate unique serial number
    const uniqueSerialNo = generatePaymentSerial();
    console.log(`📋 Generated Payment Serial Number: ${uniqueSerialNo}`);

    const newPayment = new PaymentNpp({
      uniqueSerialNo,
      requesterName,
      department,
      emailId,
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      contactNo,
      organization: organization || 'Radiant Appliances',
      designation,
      paymentDueTo,
      level,
      paymentTo,
      purposeAndObjective,
      expenseType,
      expenseAmount,
      balanceForPayment,
      deduction,
      bankDetails,
      remarks,
      sapName,
      sapCode,
      titleOfActivity: titleOfActivity || purposeAndObjective?.substring(0, 100) || '',
      amount: amount || Number(expenseAmount) || 0,
      invoices: invoices || [],
      stakeholders: stakeholders || [],
      ccList: ccList || [],
      attachments: attachments || [],
      source: source || 'PAYMENT-ADVISE-NPP',
      status: status || 'Pending'
    });

    const savedPayment = await newPayment.save();
    console.log("✅ Payment NPP saved successfully:", savedPayment._id);
    console.log(`📋 Payment Serial Number: ${savedPayment.uniqueSerialNo}`);

    // Send ONE email to all recipients
    try {
      await sendPaymentEmail(savedPayment, 'created', null);
      console.log("📧 Payment email sent successfully to all recipients");
    } catch (emailErr) {
      console.error('⚠️ Email sending error:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Payment Advice created successfully',
      serialNumber: savedPayment.uniqueSerialNo,
      data: savedPayment
    });
  } catch (err) {
    console.error("❌ Error in createPaymentNpp:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all Payment NPP
const listPaymentNpp = async (req, res) => {
  try {
    const rows = await PaymentNpp.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single Payment NPP
const getPaymentNpp = async (req, res) => {
  try {
    const row = await PaymentNpp.findById(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Payment advice not found" });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update Payment NPP
const updatePaymentNpp = async (req, res) => {
  try {
    const updated = await PaymentNpp.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Payment advice not found" });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Payment NPP
const deletePaymentNpp = async (req, res) => {
  try {
    const deleted = await PaymentNpp.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Payment advice not found" });
    }
    res.json({ success: true, message: "Payment advice deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve Payment NPP
const approvePaymentNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Approver';
    
    const payment = await PaymentNpp.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment advice not found" });
    }
    
    if (payment.stakeholders && payment.stakeholders.length > 0) {
      const pendingApprover = payment.stakeholders.find(s => s.status === 'Pending');
      if (pendingApprover) {
        pendingApprover.status = 'Approved';
        pendingApprover.remarks = comments;
        pendingApprover.dateTime = new Date().toISOString();
      }
      const remainingPending = payment.stakeholders.filter(s => s.status === 'Pending');
      payment.status = remainingPending.length === 0 ? 'Approved' : 'In-Process';
    } else {
      payment.status = 'Approved';
    }
    
    payment.approvedAt = new Date();
    payment.approvedBy = userName;
    payment.approvalComments = comments;
    await payment.save();
    
    try {
      await sendPaymentEmail(payment, 'approved', { name: userName, remarks: comments });
      console.log("📧 Approval email sent");
    } catch (emailErr) {
      console.error('Approval email error:', emailErr.message);
    }
    
    res.json({ success: true, message: "Payment advice approved", data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reject Payment NPP
const rejectPaymentNpp = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userName = req.user?.name || 'Rejecter';
    
    const payment = await PaymentNpp.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment advice not found" });
    }
    
    if (payment.stakeholders && payment.stakeholders.length > 0) {
      const pendingApprover = payment.stakeholders.find(s => s.status === 'Pending');
      if (pendingApprover) {
        pendingApprover.status = 'Rejected';
        pendingApprover.remarks = comments;
        pendingApprover.dateTime = new Date().toISOString();
      }
    }
    
    payment.status = 'Rejected';
    payment.rejectedAt = new Date();
    payment.rejectedBy = userName;
    payment.rejectionComments = comments;
    await payment.save();
    
    try {
      await sendPaymentEmail(payment, 'rejected', { name: userName, remarks: comments });
      console.log("📧 Rejection email sent");
    } catch (emailErr) {
      console.error('Rejection email error:', emailErr.message);
    }
    
    res.json({ success: true, message: "Payment advice rejected", data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPaymentNpp,
  listPaymentNpp,
  getPaymentNpp,
  updatePaymentNpp,
  deletePaymentNpp,
  approvePaymentNpp,
  rejectPaymentNpp
};