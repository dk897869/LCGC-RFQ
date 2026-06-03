// controllers/npp.controller.js
const NPPRequest = require('../models/nppRequest.model');
const User = require('../models/user.model');
const { sendMail } = require('../services/mail.service');
const { generateBeautifulPDF } = require('../services/pdf.service');

// Helper function to generate serial number
const generateNppSerialNumber = (type) => {
  const prefix = {
    'cash-purchase': 'CP',
    'new-vendor': 'NV',
    'rfq-vendor': 'RFQV',
    'rfq-requisition': 'RFQ',
    'pr-request': 'PR',
    'po-npp': 'PO',
    'payment-advise': 'PAY',
    'wcc-npp': 'WCC',
    'vendor-list': 'VL',
    'employee-detail': 'EMP',
    'item-master': 'IM',
    'quotation-submission': 'QSV',
    'quotation-comparison': 'QC'
  }[type] || 'NPP';
  
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
};

// Helper to send email
const normalizeEmailList = (value) => {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
};

const requestTypeFromPath = (path = '') => {
  const match = String(path).match(/\/api\/(?:npp|npp-forms|forms)\/([^/?]+)/);
  return match ? match[1] : null;
};

const normalizeType = (type = '') => {
  const aliases = {
    rfq: 'rfq-vendor',
    'rfq-request': 'rfq-vendor',
    requisition: 'rfq-requisition',
    'quotation-collection': 'quotation-comparison',
    quotation: 'quotation-submission',
    pr: 'pr-request',
    po: 'po-npp',
    wcc: 'wcc-npp',
    payment: 'payment-advise'
  };
  const value = String(type || '').trim();
  return aliases[value] || value;
};

const deriveRfqNo = (requestData = {}) => {
  const candidates = [
    requestData.rfqNo,
    requestData.rfqNumber,
    requestData.form?.rfqNo,
    requestData.form?.rfqNumber,
    ...(requestData.rfqVendorItems || []).map((item) => item.rfqNo),
    ...(requestData.rfqItems || []).map((item) => item.rfqNo),
    ...(requestData.quotationItems || []).map((item) => item.rfqNo),
    ...(requestData.quotationSubmissionItems || []).map((item) => item.rfqNo),
    ...(requestData.prItems || []).map((item) => item.rfqNo)
  ];
  return String(candidates.find(Boolean) || '').trim();
};

const buildSearchFilter = ({ type, serialNo, rfqNo, q, status, fromDate, toDate } = {}) => {
  const filter = {};
  const normalizedType = normalizeType(type);
  if (normalizedType && normalizedType !== 'all') filter.type = normalizedType;
  if (status && status !== 'all') filter.status = status;
  if (fromDate || toDate) {
    filter.requestDate = {};
    if (fromDate) filter.requestDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.requestDate.$lte = end;
    }
  }

  const searchTerms = [];
  if (serialNo) searchTerms.push(String(serialNo).trim());
  if (rfqNo) searchTerms.push(String(rfqNo).trim());
  if (q) searchTerms.push(String(q).trim());

  if (searchTerms.length) {
    const regexes = searchTerms.filter(Boolean).map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    filter.$or = regexes.flatMap((regex) => [
      { uniqueSerialNo: regex },
      { rfqNo: regex },
      { titleOfActivity: regex },
      { requesterName: regex },
      { 'rfqVendorItems.rfqNo': regex },
      { 'quotationItems.rfqNo': regex },
      { 'quotationSubmissionItems.rfqNo': regex },
      { 'prItems.rfqNo': regex }
    ]);
  }

  return filter;
};

const toPdfData = (request) => {
  const d = request.toObject ? request.toObject() : request;
  return {
    ...d,
    requesterName: d.requesterName,
    titleOfActivity: d.titleOfActivity,
    amount: d.amount || d.paymentDetails?.expenseAmount || d.quotationItems?.reduce((sum, row) => sum + Number(row.supplier1Amount || row.supplier2Amount || row.supplier3Amount || 0), 0),
    items: d.prItems || d.poItems || d.rfqItems || d.rfqVendorItems || d.cashPurchaseItems || d.quotationItems || [],
    invoices: d.paymentInvoices || [],
    source: d.type === 'po-npp' ? 'PO-NPP'
      : d.type === 'pr-request' ? 'PR-REQUEST-NPP'
      : d.type === 'payment-advise' ? 'PAYMENT-ADVISE-NPP'
      : d.type
  };
};

const sendNppEmail = async (request, subject, message) => {
  try {
    let adminEmails = [];
    try {
      const admins = await User.find({
        isActive: { $ne: false },
        role: { $in: ['Admin', 'Manager', 'Senior Manager'] }
      }).select('email').lean();
      adminEmails = admins.map(user => user.email);
    } catch (lookupError) {
      console.error('Admin notification lookup error:', lookupError.message);
    }

    const requesterEmail = request.emailId;
    const stakeholderEmails = normalizeEmailList((request.stakeholders || []).map(s => s.email));
    const ccList = normalizeEmailList(request.ccList);
    const enteredEmails = normalizeEmailList([
      request.emailId,
      request.vendorEmail,
      ...(request.vendorDetails || []).map(v => v.email),
      ...(request.vendorList || []).map(v => v.emailId),
      ...(request.employeeDetails || []).map(e => e.emailAddress)
    ]);
    const allRecipients = normalizeEmailList([requesterEmail, ...stakeholderEmails, ...enteredEmails, ...adminEmails]);
    
    if (allRecipients.length === 0 && ccList.length === 0) return;

    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(toPdfData(request));
    } catch (error) {
      console.error('NPP PDF generation error:', error.message);
    }

    const attachments = pdfBuffer ? [{
      filename: `${request.type || 'NPP'}_${request.uniqueSerialNo || request._id}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>${subject}</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h2>${subject}</h2>
        <p><strong>Request Type:</strong> ${request.type}</p>
        <p><strong>Serial No:</strong> ${request.uniqueSerialNo}</p>
        <p><strong>Title:</strong> ${request.titleOfActivity}</p>
        <p><strong>Requester:</strong> ${request.requesterName}</p>
        <p><strong>Department:</strong> ${request.department}</p>
        <p><strong>Status:</strong> ${request.status}</p>
        <p><strong>Message:</strong> ${message}</p>
        <hr>
        <p>Please login to the system to review, add remarks, approve, or reject.</p>
      </body>
      </html>
    `;
    
    const to = requesterEmail || allRecipients[0];
    const cc = normalizeEmailList([
      ...ccList,
      ...allRecipients.filter((email) => email !== String(to || '').toLowerCase())
    ]);

    await sendMail({
      to,
      cc,
      subject,
      html: emailHtml,
      text: message,
      attachments
    });
  } catch (error) {
    console.error('Send NPP email error:', error);
  }
};

// ==================== CREATE NPP REQUEST ====================
exports.createNppRequest = async (req, res) => {
  try {
    const { type: bodyType, ...requestData } = req.body;
    const type = normalizeType(req.params.type || bodyType || requestData.source || requestTypeFromPath(req.originalUrl || req.url));
    
    if (!type) {
      return res.status(400).json({ success: false, message: "Request type is required" });
    }
    
    const serialNo = generateNppSerialNumber(type);
    
    const nppRequest = new NPPRequest({
      type,
      uniqueSerialNo: serialNo,
      rfqNo: deriveRfqNo(requestData),
      formData: requestData,
      status: 'Pending',
      requesterName: requestData.requesterName || req.user?.name,
      department: requestData.department,
      emailId: requestData.emailId || req.user?.email,
      requestDate: requestData.requestDate || new Date(),
      contactNo: requestData.contactNo,
      organization: requestData.organization,
      titleOfActivity: requestData.titleOfActivity,
      priority: requestData.priority || 'M',
      purposeAndObjective: requestData.purposeAndObjective,
      amount: requestData.amount || requestData.estimatedAmount || requestData.paymentDetails?.expenseAmount || 0,
      vendorEmail: requestData.vendorEmail,
      stakeholders: requestData.stakeholders || [],
      ccList: requestData.ccList || [],
      attachments: requestData.attachments || [],
      createdBy: req.user?.id,
      cashPurchaseItems: requestData.cashPurchaseItems,
      vendorDetails: requestData.vendorDetails,
      rfqVendorItems: requestData.rfqVendorItems,
      rfqItems: requestData.rfqItems,
      vendorList: requestData.vendorList,
      employeeDetails: requestData.employeeDetails,
      itemMasterList: requestData.itemMasterList,
      quotationSubmissionItems: requestData.quotationSubmissionItems,
      quotationItems: requestData.quotationItems,
      supplierNames: requestData.supplierNames,
      quotationTerms: requestData.quotationTerms,
      recommendation: requestData.recommendation,
      prItems: requestData.prItems,
      poItems: requestData.poItems,
      poVendorDetails: requestData.poVendorDetails,
      poOrderDetails: requestData.poOrderDetails,
      poAddressDetails: requestData.poAddressDetails,
      poTerms: requestData.poTerms,
      poFinanceRows: requestData.poFinanceRows,
      poDeliverySchedule: requestData.poDeliverySchedule,
      paymentInvoices: requestData.paymentInvoices,
      paymentDetails: requestData.paymentDetails,
      wccDetails: requestData.wccDetails,
      wccEvaluationRows: requestData.wccEvaluationRows
    });
    
    await nppRequest.save();
    
    // Send email notifications
    await sendNppEmail(nppRequest, `New ${type} Request - ${serialNo}`, `A new request has been created and is pending your approval.`);
    
    res.status(201).json({
      success: true,
      message: `${type} request created successfully`,
      data: nppRequest,
      serialNo: serialNo
    });
    
  } catch (error) {
    console.error('Create NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET ALL NPP REQUESTS ====================
exports.getAllNppRequests = async (req, res) => {
  try {
    const { type: queryType, status, department, startDate, endDate, serialNo, rfqNo, q } = req.query;
    const type = req.params.type || queryType;
    let filter = {};
    
    if (type) filter.type = normalizeType(type);
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.requestDate = {};
      if (startDate) filter.requestDate.$gte = new Date(startDate);
      if (endDate) filter.requestDate.$lte = new Date(endDate);
    }
    if (serialNo || rfqNo || q) {
      filter = { ...filter, ...buildSearchFilter({ serialNo, rfqNo, q }) };
    }
    
    const requests = await NPPRequest.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
    
  } catch (error) {
    console.error('Get NPP requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET NPP REQUEST BY ID ====================
exports.getNppRequestById = async (req, res) => {
  try {
    const request = await NPPRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET NPP REQUEST BY SERIAL NO ====================
exports.getNppRequestBySerialNo = async (req, res) => {
  try {
    const request = await NPPRequest.findOne({ uniqueSerialNo: new RegExp(`^${String(req.params.serialNo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get NPP request by serial error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE NPP REQUEST ====================
exports.updateNppRequest = async (req, res) => {
  try {
    const request = await NPPRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    
    res.json({
      success: true,
      message: "Request updated successfully",
      data: request
    });
    
  } catch (error) {
    console.error('Update NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DELETE NPP REQUEST ====================
exports.deleteNppRequest = async (req, res) => {
  try {
    const request = await NPPRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    res.json({ success: true, message: "Request deleted successfully" });
  } catch (error) {
    console.error('Delete NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== APPROVE NPP REQUEST ====================
exports.approveNppRequest = async (req, res) => {
  try {
    const { comments = '' } = req.body;
    const actor = req.user;
    const request = await NPPRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    
    if (['Approved', 'Rejected'].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Request already finalized" });
    }
    
    request.status = 'Approved';
    request.approvedBy = actor.name || actor.email;
    request.approvedAt = new Date();
    request.approvalComments = comments;
    await request.save();
    
    await sendNppEmail(request, `Request Approved - ${request.uniqueSerialNo}`, `Your request has been approved by ${actor.name || actor.email}. Comments: ${comments}`);
    
    res.json({
      success: true,
      message: "Request approved successfully",
      data: request
    });
    
  } catch (error) {
    console.error('Approve NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REJECT NPP REQUEST ====================
exports.rejectNppRequest = async (req, res) => {
  try {
    const { comments = '' } = req.body;
    const actor = req.user;
    const request = await NPPRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    
    if (['Approved', 'Rejected'].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Request already finalized" });
    }
    
    request.status = 'Rejected';
    request.rejectedBy = actor.name || actor.email;
    request.rejectedAt = new Date();
    request.rejectionReason = comments;
    await request.save();
    
    await sendNppEmail(request, `Request Rejected - ${request.uniqueSerialNo}`, `Your request has been rejected by ${actor.name || actor.email}. Reason: ${comments}`);
    
    res.json({
      success: true,
      message: "Request rejected",
      data: request
    });
    
  } catch (error) {
    console.error('Reject NPP request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET NPP STATS ====================
exports.getNppStats = async (req, res) => {
  try {
    const total = await NPPRequest.countDocuments();
    const pending = await NPPRequest.countDocuments({ status: 'Pending' });
    const approved = await NPPRequest.countDocuments({ status: 'Approved' });
    const rejected = await NPPRequest.countDocuments({ status: 'Rejected' });
    const inProcess = await NPPRequest.countDocuments({ status: 'In-Process' });
    
    const byType = await NPPRequest.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      stats: { total, pending, approved, rejected, inProcess },
      byType
    });
    
  } catch (error) {
    console.error('Get NPP stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEND NPP REQUEST EMAIL ====================
exports.sendNppRequestEmail = async (req, res) => {
  try {
    const { toEmails, ccEmails, subject, message } = req.body;
    const request = await NPPRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    
    const recipients = normalizeEmailList(toEmails || request.stakeholders?.map(s => s.email) || request.emailId);
    const ccList = normalizeEmailList(ccEmails || request.ccList || []);
    
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "No recipients specified" });
    }
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>${subject || 'NPP Request Notification'}</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h2>${subject || 'NPP Request Notification'}</h2>
        <p><strong>Request Type:</strong> ${request.type}</p>
        <p><strong>Serial No:</strong> ${request.uniqueSerialNo}</p>
        <p><strong>Title:</strong> ${request.titleOfActivity}</p>
        <p><strong>Requester:</strong> ${request.requesterName}</p>
        <p><strong>Status:</strong> ${request.status}</p>
        <p><strong>Message:</strong> ${message || 'Please review this request.'}</p>
        <hr>
        <p>Please login to the system to review and take action.</p>
      </body>
      </html>
    `;
    
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateBeautifulPDF(toPdfData(request));
    } catch (error) {
      console.error('NPP PDF generation error:', error.message);
    }

    const attachments = pdfBuffer ? [{
      filename: `${request.type || 'NPP'}_${request.uniqueSerialNo || request._id}.pdf`,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf'
    }] : [];
    
    const result = await sendMail({
      to: recipients[0],
      cc: normalizeEmailList([...ccList, ...recipients.slice(1)]),
      subject: subject || `NPP Request - ${request.uniqueSerialNo}`,
      html: emailHtml,
      text: message || 'Please review this request.',
      attachments
    });
    const results = recipients.map((email) => ({ email, success: result.success }));
    
    res.json({
      success: true,
      message: `Email sent to ${recipients.length} recipient(s)`,
      results
    });
    
  } catch (error) {
    console.error('Send NPP email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchNppRequests = async (req, res) => {
  try {
    const filter = buildSearchFilter(req.query);
    const requests = await NPPRequest.find(filter).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100);
    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Search NPP requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNppRequestsByRfqNo = async (req, res) => {
  try {
    const rfqNo = req.params.rfqNo;
    const requests = await NPPRequest.find(buildSearchFilter({ rfqNo })).sort({ createdAt: -1 });
    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'No requests found for this RFQ number' });
    }
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get NPP request by RFQ error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
