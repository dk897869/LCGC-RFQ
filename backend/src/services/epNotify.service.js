const { sendMail } = require('./mail.service');
const { generateBeautifulPDF } = require('./pdf.service');

// Send EP Request Created Email
const sendEPRequestCreatedEmail = async (request) => {
  const subject = `📋 New EP Request: ${request.title}`;
  
  console.log(`📧 Sending EP Request Created Email to: ${request.email}`);
  if (request.ccList && request.ccList.length > 0) {
    console.log(`📧 CC recipients: ${request.ccList.join(', ')}`);
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(request);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: request.email,
    cc: request.ccList || [],
    subject: subject,
    epRequestData: request,
    action: 'created',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `EP_Request_${request._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send EP Request Approved Email
const sendEPRequestApprovedEmail = async (request, approver) => {
  const subject = `✅ EP Request Approved: ${request.title}`;
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(request);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: request.email,
    cc: request.ccList || [],
    subject: subject,
    epRequestData: request,
    action: 'approved',
    actor: approver,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `EP_Request_${request._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send EP Request Rejected Email
const sendEPRequestRejectedEmail = async (request, approver) => {
  const subject = `❌ EP Request Rejected: ${request.title}`;
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(request);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: request.email,
    cc: request.ccList || [],
    subject: subject,
    epRequestData: request,
    action: 'rejected',
    actor: approver,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `EP_Request_${request._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send New EP Request to Approver
const sendNewEPRequestEmail = async (request, approver) => {
  const subject = `⚠️ Action Required: ${request.title}`;
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(request);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: approver.email,
    cc: request.ccList || [],
    subject: subject,
    epRequestData: request,
    action: 'approval_needed',
    actor: null,
    nextApprover: approver,
    attachments: pdfBuffer ? [{
      filename: `EP_Request_${request._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send EP CC Notification
const sendEPCCNotificationEmail = async (request, ccEmail) => {
  const subject = `📋 CC: EP Request - ${request.title}`;
  
  console.log(`📧 Sending CC notification to: ${ccEmail}`);
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(request);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: ccEmail,
    subject: subject,
    epRequestData: request,
    action: 'cc_notification',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `EP_Request_${request._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send Bulk CC Notifications
const sendEPBulkCCNotifications = async (request) => {
  if (!request.ccList || request.ccList.length === 0) {
    console.log('📧 No CC recipients found');
    return { success: true, message: 'No CC recipients' };
  }
  
  console.log(`📧 Sending bulk CC notifications to ${request.ccList.length} recipients`);
  const results = [];
  
  for (const ccEmail of request.ccList) {
    const result = await sendEPCCNotificationEmail(request, ccEmail);
    results.push({ email: ccEmail, ...result });
  }
  
  return { success: true, results };
};

// Send RFQ Created Email
const sendRFQCreatedEmail = async (rfqData) => {
  const subject = `📋 New RFQ: ${rfqData.titleOfActivity}`;
  
  console.log(`📧 Sending RFQ Created Email to: ${rfqData.emailId}`);
  if (rfqData.ccTo && rfqData.ccTo.length > 0) {
    console.log(`📧 CC recipients: ${rfqData.ccTo.join(', ')}`);
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(rfqData);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: rfqData.emailId,
    cc: rfqData.ccTo || [],
    subject: subject,
    rfqData: rfqData,
    action: 'created',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `RFQ_${rfqData._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send PR NPP Created Email
const sendPRNppCreatedEmail = async (prData) => {
  const subject = `📋 New PR Request: ${prData.titleOfActivity || 'PR Request'}`;
  
  console.log(`📧 Sending PR NPP Created Email to: ${prData.emailId}`);
  if (prData.ccList && prData.ccList.length > 0) {
    console.log(`📧 CC recipients: ${prData.ccList.join(', ')}`);
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(prData);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: prData.emailId,
    cc: prData.ccList || [],
    subject: subject,
    prRequestData: prData,
    action: 'created',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `PR_${prData._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send PO NPP Created Email
const sendPONppCreatedEmail = async (poData) => {
  const subject = `📋 New PO Created: ${poData.orderNo || poData.titleOfActivity || 'Purchase Order'}`;
  
  console.log(`📧 Sending PO NPP Created Email to: ${poData.emailId}`);
  if (poData.ccList && poData.ccList.length > 0) {
    console.log(`📧 CC recipients: ${poData.ccList.join(', ')}`);
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(poData);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: poData.emailId,
    cc: poData.ccList || [],
    subject: subject,
    poRequestData: poData,
    action: 'created',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `PO_${poData.orderNo || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Send Payment Advice Created Email
const sendPaymentAdviceCreatedEmail = async (paymentData) => {
  const subject = `📋 New Payment Advice: ${paymentData.titleOfActivity || paymentData.paymentTo || 'Payment Request'}`;
  
  console.log(`📧 Sending Payment Advice Email to: ${paymentData.emailId}`);
  if (paymentData.ccList && paymentData.ccList.length > 0) {
    console.log(`📧 CC recipients: ${paymentData.ccList.join(', ')}`);
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(paymentData);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: paymentData.emailId,
    cc: paymentData.ccList || [],
    subject: subject,
    paymentRequestData: paymentData,
    action: 'created',
    actor: null,
    nextApprover: null,
    attachments: pdfBuffer ? [{
      filename: `Payment_${paymentData._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

// Universal function
const sendRequestEmailWithCC = async (requestData, type, options = {}) => {
  const { actor, nextApprover, isEP = false, isRFQ = false, isPR = false, isPO = false, isPayment = false } = options;
  
  let to = '';
  let cc = [];
  let subject = '';
  let dataParam = {};
  
  if (isEP || requestData.stakeholders) {
    to = requestData.email;
    cc = requestData.ccList || [];
    dataParam = { epRequestData: requestData };
    subject = `📋 EP Request: ${requestData.title}`;
  } else if (isRFQ || requestData.items) {
    to = requestData.emailId;
    cc = requestData.ccTo || [];
    dataParam = { rfqData: requestData };
    subject = `📋 RFQ: ${requestData.titleOfActivity}`;
  } else if (isPR || requestData.source === 'PR-REQUEST-NPP') {
    to = requestData.emailId;
    cc = requestData.ccList || [];
    dataParam = { prRequestData: requestData };
    subject = `📋 PR Request: ${requestData.titleOfActivity}`;
  } else if (isPO || requestData.source === 'PO-NPP') {
    to = requestData.emailId;
    cc = requestData.ccList || [];
    dataParam = { poRequestData: requestData };
    subject = `📋 PO: ${requestData.orderNo || requestData.titleOfActivity}`;
  } else if (isPayment || requestData.source === 'PAYMENT-ADVISE-NPP') {
    to = requestData.emailId;
    cc = requestData.ccList || [];
    dataParam = { paymentRequestData: requestData };
    subject = `📋 Payment Advice: ${requestData.titleOfActivity}`;
  }
  
  if (!to) {
    console.log(`⚠️ No recipient email found`);
    return { success: false, error: 'No recipient email' };
  }
  
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateBeautifulPDF(requestData);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }
  
  return await sendMail({
    to: to,
    cc: cc,
    subject: subject,
    ...dataParam,
    action: type,
    actor: actor,
    nextApprover: nextApprover,
    attachments: pdfBuffer ? [{
      filename: `Request_${requestData._id || Date.now()}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : []
  });
};

module.exports = {
  sendEPRequestCreatedEmail,
  sendEPRequestApprovedEmail,
  sendEPRequestRejectedEmail,
  sendNewEPRequestEmail,
  sendEPCCNotificationEmail,
  sendEPBulkCCNotifications,
  sendRFQCreatedEmail,
  sendPRNppCreatedEmail,
  sendPONppCreatedEmail,
  sendPaymentAdviceCreatedEmail,
  sendRequestEmailWithCC,
  sendNewRequestEmail: sendNewEPRequestEmail,
  sendApprovedEmail: sendEPRequestApprovedEmail,
  sendRejectedEmail: sendEPRequestRejectedEmail,
  sendInProcessEmail: sendEPRequestCreatedEmail,
  sendNextApproverEmail: sendNewEPRequestEmail,
  sendAttachmentEmail: sendEPRequestCreatedEmail,
  sendApprovalUpdateToCC: sendEPBulkCCNotifications
};