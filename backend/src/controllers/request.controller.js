const Request = require('../models/request');
const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const { sendMail } = require('../services/mail.service');
const { generatePDFFromRequest } = require('../services/pdf.service');
const epNotify = require('../services/epNotify.service');

const SENIOR_APPROVER_ROLES = ['Admin', 'Manager', 'Senior Manager', 'VP', 'GM', 'MD', 'Director', 'AGM', 'Approver'];
const memoryEpRequests = [];
const isDbConnected = () => mongoose.connection.readyState === 1;

const isSeniorApprover = (user = {}) => SENIOR_APPROVER_ROLES.includes(user.role);

// ====================== CREATE REQUEST ======================
const createRequest = async (req, res) => {
  try {
    console.log("📥 Received EP Request data:", JSON.stringify(req.body, null, 2));
    
    const {
      requester,
      department,
      email,
      requestDate,
      contactNo,
      organization,
      title,
      vendor,
      amount,
      priority,
      description,
      objective,
      stakeholders,
      attachments,
      ccList,
      status
    } = req.body;

    // Validation
    if (!requester) {
      return res.status(400).json({
        success: false,
        message: "requester is required"
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required"
      });
    }

    // Prepare stakeholders with approvalOrder
    const processedStakeholders = (stakeholders || []).map((s, idx) => ({
      ...s,
      approvalOrder: s.approvalOrder || idx + 1,
      status: 'Pending',
      dateTime: null
    }));

    if (!isDbConnected()) {
      const now = new Date();
      const fallbackRequest = {
        _id: `mem-ep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        id: `mem-ep-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        requester,
        department,
        email,
        requestDate: requestDate || now.toISOString().split('T')[0],
        contactNo: contactNo || '',
        organization: organization || 'Radiant Appliances',
        title,
        vendor: vendor || '',
        amount: Number(amount) || 1,
        priority: priority || 'Medium',
        description: description || '',
        objective: objective || '',
        stakeholders: processedStakeholders,
        attachments: attachments || [],
        ccList: ccList || [],
        status: status || 'Pending',
        createdBy: req.user?.id,
        createdByName: req.user?.name || requester,
        currentApproverIndex: 0,
        createdAt: now,
        updatedAt: now,
        fromMemoryFallback: true
      };
      memoryEpRequests.unshift(fallbackRequest);
      return res.status(201).json({
        success: true,
        message: 'EP Request created successfully',
        data: fallbackRequest
      });
    }

    // Create new request
    const newRequest = new Request({
      requester,
      department,
      email,
      requestDate: requestDate || new Date().toISOString().split('T')[0],
      contactNo: contactNo || '',
      organization: organization || 'Radiant Appliances',
      title,
      vendor: vendor || '',
      amount: Number(amount) || 0,
      priority: priority || 'Medium',
      description: description || '',
      objective: objective || '',
      stakeholders: processedStakeholders,
      attachments: attachments || [],
      ccList: ccList || [],
      status: status || 'Pending',
      createdBy: req.user?.id,
      createdByName: req.user?.name || requester,
      currentApproverIndex: 0
    });

    const savedRequest = await newRequest.save();
    console.log("✅ EP Request saved successfully:", savedRequest._id);

    // Create database Notification record
    try {
      await Notification.create({
        userEmail: savedRequest.email,
        title: `EP Request Created: ${savedRequest.title}`,
        message: `Your EP request ${savedRequest.requestId || savedRequest._id} for ₹${savedRequest.amount} is pending approval.`,
        type: 'ep',
        status: 'Pending'
      });
    } catch (dbErr) {
      console.error('Failed to create DB notification on createRequest:', dbErr.message);
    }

    // ====================== SEND EMAILS (AFTER savedRequest is created) ======================
    
    // 1. Send email to requester
    res.status(201).json({
      success: true,
      message: 'EP Request created successfully',
      data: savedRequest
    });

    await epNotify.sendEPRequestCreatedEmail(savedRequest);
    console.log(`📧 Created email sent to requester: ${savedRequest.email}`);
    
    // 2. Send to first approver
    if (savedRequest.stakeholders && savedRequest.stakeholders.length > 0) {
      const firstApprover = savedRequest.stakeholders[0];
      await epNotify.sendNewEPRequestEmail(savedRequest, firstApprover);
      console.log(`📧 Approval request sent to: ${firstApprover.email}`);
    }
    
    // 3. Send CC notifications
    if (savedRequest.ccList && savedRequest.ccList.length > 0) {
      for (const ccEmail of savedRequest.ccList) {
        await epNotify.sendEPCCNotificationEmail(savedRequest, ccEmail);
        console.log(`📧 CC email sent to: ${ccEmail}`);
      }
    }

    if (!res.headersSent) {
      res.status(201).json({
        success: true,
        message: 'EP Request created successfully',
        data: savedRequest
      });
    }

  } catch (err) {
    console.error("❌ Error in createRequest:", err);
    if (res.headersSent) return;
    res.status(500).json({
      success: false,
      message: err.message || "Failed to create EP Request"
    });
  }
};

// ====================== GET ALL REQUESTS ======================
const getRequests = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, department, priority } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (department) query.department = department;
    if (priority) query.priority = priority;

    if (!isDbConnected()) {
      let requests = [...memoryEpRequests];
      if (status) requests = requests.filter(r => r.status === status);
      if (department) requests = requests.filter(r => r.department === department);
      if (priority) requests = requests.filter(r => r.priority === priority);
      const paged = requests.slice((page - 1) * limit, page * limit);
      return res.status(200).json({
        success: true,
        count: paged.length,
        total: requests.length,
        page: parseInt(page),
        pages: Math.ceil(requests.length / limit),
        data: paged
      });
    }
    
    const combinedQuery = {
      $and: [
        query,
        { title: { $exists: true, $ne: '', $nin: ['Nm', 'nm', 'NM'] } },
        { requester: { $exists: true, $ne: '' } }
      ]
    };

    const requests = await Request.find(combinedQuery)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Request.countDocuments(combinedQuery);
    
    res.status(200).json({
      success: true,
      count: requests.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: requests
    });
  } catch (err) {
    console.error("Error in getRequests:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: err.message
    });
  }
};

// ====================== GET SINGLE REQUEST ======================
const getRequestById = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "EP Request not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: request
    });
  } catch (err) {
    console.error("Error in getRequestById:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch request",
      error: err.message
    });
  }
};

// ====================== UPDATE REQUEST ======================
const updateRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "EP Request not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "EP Request updated successfully",
      data: request
    });
  } catch (err) {
    console.error("Error in updateRequest:", err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// ====================== DELETE REQUEST ======================
const deleteRequest = async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "EP Request not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "EP Request deleted successfully"
    });
  } catch (err) {
    console.error("Error in deleteRequest:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ====================== APPROVE REQUEST ======================
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userEmail = req.user?.email;
    const userName = req.user?.name || 'Approver';
    
    const request = await Request.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "EP Request not found"
      });
    }
    
    // Senior approvers can act from the dashboard modal; listed approvers can act in normal flow.
    if (!isSeniorApprover(req.user) && !request.canUserApprove(userEmail)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this request"
      });
    }
    
    let currentApprover = request.getCurrentApprover();
    if (!currentApprover && isSeniorApprover(req.user)) {
      currentApprover = request.stakeholders?.find(s => s.status === 'Pending') || null;
    }
    if (!currentApprover) {
      return res.status(400).json({
        success: false,
        message: "No pending approver found"
      });
    }
    
    // Update current approver status
    currentApprover.status = 'Approved';
    currentApprover.remarks = comments || '';
    currentApprover.dateTime = new Date();
    currentApprover.approvedBy = userName;
    
    // Check if there are more approvers
    const remainingPending = request.stakeholders.filter(s => s.status === 'Pending');
    
    if (remainingPending.length === 0) {
      request.status = 'Approved';
      request.approvedBy = userName;
      request.approvedAt = new Date();
      request.approvalComments = comments;
      request.completionDate = new Date();
    } else {
      request.status = 'In-Process';
      remainingPending.sort((a, b) => (a.approvalOrder || 0) - (b.approvalOrder || 0));
    }
    
    await request.save();

    // Create database Notification record
    try {
      await Notification.create({
        userEmail: request.email,
        title: `EP Request Approved: ${request.title}`,
        message: `Your EP request ${request.requestId || request._id} has been approved by ${userName}.`,
        type: 'ep',
        status: 'Approved'
      });
    } catch (dbErr) {
      console.error('Failed to create DB notification on approveRequest:', dbErr.message);
    }
    
    // Send approval email to requester
    await epNotify.sendEPRequestApprovedEmail(request, { name: userName, remarks: comments });
    console.log(`📧 Approval email sent to requester: ${request.email}`);
    
    // Send notification to next approver if any
    const nextApprover = request.getCurrentApprover();
    if (nextApprover && nextApprover !== currentApprover) {
      await epNotify.sendNextEPApproverEmail(request, nextApprover, { name: userName });
      console.log(`📧 Next approver notified: ${nextApprover.email}`);
    }
    
    // Send CC notifications
    if (request.ccList && request.ccList.length > 0) {
      for (const ccEmail of request.ccList) {
        await epNotify.sendEPCCNotificationEmail(request, ccEmail);
      }
    }
    
    res.status(200).json({
      success: true,
      message: "EP Request approved successfully",
      data: request
    });
  } catch (err) {
    console.error("Error in approveRequest:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to approve request"
    });
  }
};

// ====================== REJECT REQUEST ======================
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userEmail = req.user?.email;
    const userName = req.user?.name || 'Approver';
    
    const request = await Request.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "EP Request not found"
      });
    }
    
    // Senior approvers can reject from the dashboard modal; listed approvers can act in normal flow.
    if (!isSeniorApprover(req.user) && !request.canUserApprove(userEmail)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this request"
      });
    }
    
    const currentApprover = request.getCurrentApprover();
    if (currentApprover) {
      currentApprover.status = 'Rejected';
      currentApprover.remarks = comments || '';
      currentApprover.dateTime = new Date();
      currentApprover.approvedBy = userName;
    }
    
    request.status = 'Rejected';
    request.rejectedBy = userName;
    request.rejectedAt = new Date();
    request.rejectionReason = comments;
    
    await request.save();

    // Create database Notification record
    try {
      await Notification.create({
        userEmail: request.email,
        title: `EP Request Rejected: ${request.title}`,
        message: `Your EP request ${request.requestId || request._id} has been rejected by ${userName}. Reason: ${comments || '—'}`,
        type: 'ep',
        status: 'Rejected'
      });
    } catch (dbErr) {
      console.error('Failed to create DB notification on rejectRequest:', dbErr.message);
    }
    
    // Send rejection email
    await epNotify.sendEPRequestRejectedEmail(request, { name: userName, remarks: comments });
    console.log(`📧 Rejection email sent to requester: ${request.email}`);
    
    // Send CC notifications
    if (request.ccList && request.ccList.length > 0) {
      for (const ccEmail of request.ccList) {
        await epNotify.sendEPCCNotificationEmail(request, ccEmail);
        console.log(`📧 CC email sent to: ${ccEmail}`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: "EP Request rejected successfully",
      data: request
    });
  } catch (err) {
    console.error("Error in rejectRequest:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to reject request"
    });
  }
};

// ====================== GET MY PENDING REQUESTS ======================
const getMyPendingRequests = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "User email not found"
      });
    }
    
    const requests = await Request.find({
      'stakeholders.email': userEmail,
      'stakeholders.status': 'Pending',
      status: { $in: ['Pending', 'In-Process'] }
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.error("Error in getMyPendingRequests:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending requests",
      error: err.message
    });
  }
};

// ====================== GET REQUESTS BY STATUS ======================
const getRequestsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    const requests = await Request.find({ status }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.error("Error in getRequestsByStatus:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests by status",
      error: err.message
    });
  }
};

// ====================== GET REQUESTS BY DEPARTMENT ======================
const getRequestsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    
    const requests = await Request.find({ 
      department: { $regex: new RegExp(department, 'i') } 
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.error("Error in getRequestsByDepartment:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests by department",
      error: err.message
    });
  }
};

// ====================== GET DEPARTMENTS ======================
const getDepartments = async (req, res) => {
  try {
    const departments = await Request.distinct('department');
    
    res.status(200).json({
      success: true,
      departments: departments.filter(d => d)
    });
  } catch (err) {
    console.error("Error in getDepartments:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
      error: err.message
    });
  }
};

// ====================== GET DASHBOARD STATS ======================
const getDashboardStats = async (req, res) => {
  try {
    const total = await Request.countDocuments();
    const pending = await Request.countDocuments({ status: 'Pending' });
    const inProcess = await Request.countDocuments({ status: 'In-Process' });
    const approved = await Request.countDocuments({ status: 'Approved' });
    const rejected = await Request.countDocuments({ status: 'Rejected' });
    const completed = await Request.countDocuments({ status: 'Completed' });
    
    // Get pending for current user
    const userEmail = req.user?.email;
    let myPending = 0;
    if (userEmail) {
      myPending = await Request.countDocuments({
        'stakeholders.email': userEmail,
        'stakeholders.status': 'Pending',
        status: { $in: ['Pending', 'In-Process'] }
      });
    }
    
    // Get recent requests
    const recent = await Request.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        inProcess,
        approved,
        rejected,
        completed,
        myPending
      },
      recent
    });
  } catch (err) {
    console.error("Error in getDashboardStats:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: err.message
    });
  }
};

// ====================== GET REQUEST STATS (alias for frontend) ======================
const getRequestStats = async (req, res) => {
  try {
    const [approved, pending, rejected, inProcess] = await Promise.all([
      Request.countDocuments({ status: 'Approved' }),
      Request.countDocuments({ status: 'Pending' }),
      Request.countDocuments({ status: 'Rejected' }),
      Request.countDocuments({ status: 'In-Process' })
    ]);
    res.status(200).json({
      success: true,
      data: { approved, pending, rejected, inProcess, total: approved + pending + rejected + inProcess }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: err.message });
  }
};

// ====================== GET FULL REQUEST DETAILS ======================
const getRequestFull = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'EP Request not found' });
    }
    res.status(200).json({
      success: true,
      data: {
        ...request.toObject(),
        id: request._id,
        canEdit: ['Pending', 'Draft', 'In-Process'].includes(request.status)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch request', error: err.message });
  }
};

// ====================== EXPORTS ======================
module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  getRequestFull,
  updateRequest,
  deleteRequest,
  approveRequest,
  rejectRequest,
  getMyPendingRequests,
  getRequestsByStatus,
  getRequestsByDepartment,
  getDepartments,
  getDashboardStats,
  getRequestStats
};
