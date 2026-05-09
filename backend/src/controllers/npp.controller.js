const NPPRequest = require('../models/nppRequest.model');
const { sendMail } = require('../services/mail.service');

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
const sendNppEmail = async (request, subject, message) => {
  try {
    const recipients = request.stakeholders?.map(s => s.email) || [];
    const ccList = request.ccList || [];
    
    if (recipients.length === 0) return;
    
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
        <p><strong>Status:</strong> ${request.status}</p>
        <p><strong>Message:</strong> ${message}</p>
        <hr>
        <p>Please login to the system to review and take action.</p>
      </body>
      </html>
    `;
    
    for (const recipient of recipients) {
      await sendMail({
        to: recipient,
        cc: ccList,
        subject: subject,
        html: emailHtml,
        text: message
      });
    }
  } catch (error) {
    console.error('Send NPP email error:', error);
  }
};

// ==================== CREATE NPP REQUEST ====================
exports.createNppRequest = async (req, res) => {
  try {
    const { type, ...requestData } = req.body;
    
    if (!type) {
      return res.status(400).json({ success: false, message: "Request type is required" });
    }
    
    const serialNo = generateNppSerialNumber(type);
    
    const nppRequest = new NPPRequest({
      type,
      uniqueSerialNo: serialNo,
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
      stakeholders: requestData.stakeholders || [],
      ccList: requestData.ccList || [],
      createdBy: req.user?.id,
      ...requestData
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
    const { type, status, department, startDate, endDate } = req.query;
    let filter = {};
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.requestDate = {};
      if (startDate) filter.requestDate.$gte = new Date(startDate);
      if (endDate) filter.requestDate.$lte = new Date(endDate);
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
    const request = await NPPRequest.findOne({ uniqueSerialNo: req.params.serialNo });
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
    
    // Update stakeholders
    if (request.stakeholders && request.stakeholders.length > 0) {
      const currentStakeholder = request.stakeholders.find(s => s.email === actor.email);
      if (currentStakeholder) {
        currentStakeholder.status = 'Approved';
        currentStakeholder.remarks = comments;
        currentStakeholder.dateTime = new Date();
      }
    }
    
    request.status = 'Approved';
    request.approvedBy = actor.name || actor.email;
    request.approvedAt = new Date();
    request.approvalComments = comments;
    await request.save();
    
    // Send email notification
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
    
    // Update stakeholders
    if (request.stakeholders && request.stakeholders.length > 0) {
      const currentStakeholder = request.stakeholders.find(s => s.email === actor.email);
      if (currentStakeholder) {
        currentStakeholder.status = 'Rejected';
        currentStakeholder.remarks = comments;
        currentStakeholder.dateTime = new Date();
      }
    }
    
    request.status = 'Rejected';
    request.rejectedBy = actor.name || actor.email;
    request.rejectedAt = new Date();
    request.rejectionReason = comments;
    await request.save();
    
    // Send email notification
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
    
    const recipients = toEmails || request.stakeholders?.map(s => s.email) || [];
    const ccList = ccEmails || request.ccList || [];
    
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
    
    const results = [];
    for (const recipient of recipients) {
      const result = await sendMail({
        to: recipient,
        cc: ccList,
        subject: subject || `NPP Request - ${request.uniqueSerialNo}`,
        html: emailHtml,
        text: message || 'Please review this request.'
      });
      results.push({ email: recipient, success: result.success });
    }
    
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