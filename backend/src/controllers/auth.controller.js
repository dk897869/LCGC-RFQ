const User = require("../models/user.model");
const OTP = require("../models/otp.model");
const EPRequest = require("../models/request");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail } = require("../services/mail.service");
const { sendEpMailWithPdf } = require("../services/epNotify.service");
const { generateEPApprovalEmailHTML } = require("../templates/epApprovalEmail");
const { buildEpPdfBuffer } = require("../utils/epPdf");
const { sendSmsOtp, verifySmsOtp } = require("../services/twilio.service");

const SENIOR_APPROVER_ROLES = new Set([
  "Admin",
  "Manager",
  "VP",
  "GM",
  "MD",
  "Director",
  "AGM",
  "Approver",
]);

function canActOnEpRequest(user, epDoc) {
  if (!user || !epDoc) return false;
  if (user.rights && user.rights.epApproval) return true;
  if (SENIOR_APPROVER_ROLES.has(user.role)) return true;
  const u = (user.email || "").toLowerCase();
  return (epDoc.stakeholders || []).some(
    (s) =>
      (s.email || "").toLowerCase() === u &&
      (s.status === "Pending" || s.status === "In-Process")
  );
}

// ==================== HELPER FUNCTIONS ====================

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, rights: user.rights || {} },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveOTP = async (email, mobile, otp, type) => {
  await OTP.deleteMany({
    $or: [{ email: email }, { mobile: mobile }],
    type: type
  });

  await OTP.create({
    email: email,
    mobile: mobile,
    otp: otp,
    type: type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
};
// ==================== SEND MOBILE OTP (Updated) ====================

exports.sendMobileOTP = async (req, res) => {
  try {
    const { mobile, type = 'registration' } = req.body;
    
    console.log('📱 Send Mobile OTP request:', { mobile, type });
    
    if (!mobile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number is required' 
      });
    }
    
    // Clean mobile number (remove any non-digit characters)
    const cleanMobile = mobile.replace(/\D/g, '');
    
    // For registration, check if mobile already exists
    if (type === 'registration') {
      const existingUser = await User.findOne({ 
        contactNo: { $regex: cleanMobile + '$', $options: 'i' } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mobile number already registered' 
        });
      }
    }
    
    // Send OTP via Twilio
    const result = await sendSmsOtp(mobile);
    
    if (!result.success) {
      console.error('Twilio SMS error:', result.error);
      return res.status(500).json({ 
        success: false, 
        message: result.error || 'Failed to send SMS. Please check Twilio configuration.',
        details: process.env.NODE_ENV === 'development' ? result : undefined
      });
    }
    
    // Store OTP reference in database
    const otp = generateOTP(); // Generate a 6-digit OTP
    await saveOTP(null, cleanMobile, otp, type);
    
    console.log(`✅ Mobile OTP sent to ${mobile}: ${otp} (development only)`);
    
    res.json({
      success: true,
      message: `OTP sent successfully to ${mobile}`,
      method: 'mobile',
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
      twilioStatus: result.status
    });
    
  } catch (error) {
    console.error('Send Mobile OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== VERIFY MOBILE OTP ====================

exports.verifyMobileOTP = async (req, res) => {
  try {
    const { mobile, otp, type = 'registration' } = req.body;
    
    console.log('🔐 Verify Mobile OTP:', { mobile, otp, type });
    
    if (!mobile || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number and OTP are required' 
      });
    }
    
    const cleanMobile = mobile.replace(/\D/g, '');
    
    // Find OTP record
    const otpRecord = await OTP.findOne({
      mobile: cleanMobile,
      otp: otp,
      type: type
    });
    
    if (!otpRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }
    
    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });
    
    res.json({
      success: true,
      message: 'Mobile OTP verified successfully',
      verified: true
    });
    
  } catch (error) {
    console.error('Verify Mobile OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== NPP PROCUREMENT APIs ====================

const NPPRequest = require("../models/nppRequest.model");

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

// Helper to send email with PDF to stakeholders
const sendNppEmailWithPdf = async (request, subject, message) => {
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
        <p><strong>Department:</strong> ${request.department}</p>
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
    await sendNppEmailWithPdf(nppRequest, `New ${type} Request - ${serialNo}`, `A new request has been created and is pending your approval.`);
    
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
    await sendNppEmailWithPdf(request, `Request Approved - ${request.uniqueSerialNo}`, `Your request has been approved by ${actor.name || actor.email}. Comments: ${comments}`);
    
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
    await sendNppEmailWithPdf(request, `Request Rejected - ${request.uniqueSerialNo}`, `Your request has been rejected by ${actor.name || actor.email}. Reason: ${comments}`);
    
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
// ==================== FORGOT PASSWORD WITH LINK ====================

/**
 * Send password reset link to user's email
 * POST /api/auth/forgot-password-link
 */
exports.sendForgotPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email address is required' 
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security, don't reveal that email doesn't exist
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive a password reset link.' 
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and save to database
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    
    await user.save({ validateBeforeSave: false });
    
    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    // Email HTML template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
          .content { padding: 30px; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          .warning { background: #fef3c7; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400e; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LCGC RFQ</h1>
            <p>Resolute Group</p>
          </div>
          <div class="content">
            <h2 style="color: #0f2a5e;">Password Reset Request</h2>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button" style="color: white;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 6px; word-break: break-all; font-size: 12px;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} LCGC RFQ. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `Password Reset Request\n\nClick the link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;
    
    // Send email
    const mailResult = await sendMail({
      to: user.email,
      subject: 'Password Reset Request - LCGC RFQ',
      html: html,
      text: text
    });
    
    if (!mailResult || mailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: mailResult?.error || 'Email could not be sent. Please try again later.'
      });
    }
    
    res.json({
      success: true,
      message: 'Password reset link sent to your email. Please check your inbox.'
    });
    
  } catch (error) {
    console.error('Forgot password link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RESET PASSWORD WITH TOKEN ====================

/**
 * Reset password using token from email link
 * POST /api/auth/reset-password-with-token
 */
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token and new password are required' 
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }
    
    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }
    
    // Update password
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();
    
    // Send confirmation email
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Changed Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f6f9; }
          .container { max-width: 500px; margin: 50px auto; background: white; border-radius: 10px; padding: 30px; text-align: center; }
          .success-icon { font-size: 64px; color: #10b981; }
          .button { display: inline-block; padding: 12px 30px; background: #0f2a5e; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h2>Password Changed Successfully!</h2>
          <p>Your password has been reset. You can now log in with your new password.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/login" class="button">Go to Login</a>
        </div>
      </body>
      </html>
    `;
    
    await sendMail({
      to: user.email,
      subject: 'Password Changed Successfully - LCGC RFQ',
      html: confirmationHtml,
      text: 'Your password has been changed successfully. If you did not perform this action, please contact support immediately.'
    }).catch(err => console.log('Confirmation email error:', err.message));
    
    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REQUEST PASSWORD RESET OTP (Alternative) ====================

/**
 * Send OTP to email for password reset
 * POST /api/auth/forgot-password-otp
 */
exports.sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email address is required' 
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive an OTP.' 
      });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save OTP to database
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });
    
    // Email HTML with OTP
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset OTP</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f6f9; }
          .container { max-width: 500px; margin: 50px auto; background: white; border-radius: 10px; padding: 30px; text-align: center; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
          .warning { font-size: 12px; color: #666; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🔐 Password Reset OTP</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Your OTP for password reset is:</p>
          <div class="otp-code">${otp}</div>
          <p>This OTP is valid for <strong>10 minutes</strong>.</p>
          <div class="warning">If you didn't request this, please ignore this email.</div>
        </div>
      </body>
      </html>
    `;
    
    const mailResult = await sendMail({
      to: user.email,
      subject: 'Password Reset OTP - LCGC RFQ',
      html: html,
      text: `Your OTP for password reset is: ${otp}. Valid for 10 minutes.`
    });
    
    if (!mailResult || mailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: mailResult?.error || 'Email could not be sent.'
      });
    }
    
    res.json({
      success: true,
      message: 'OTP sent to your email address.',
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });
    
  } catch (error) {
    console.error('Forgot password OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== VERIFY OTP AND RESET PASSWORD ====================

/**
 * Verify OTP and reset password
 * POST /api/auth/verify-otp-reset-password
 */
exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, OTP and new password are required' 
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check OTP
    if (user.resetPasswordOTP !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }
    
    if (user.resetPasswordOTPExpire < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }
    
    // Update password
    user.password = newPassword;
    user.resetPasswordOTP = null;
    user.resetPasswordOTPExpire = null;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in.'
    });
    
  } catch (error) {
    console.error('Verify OTP reset password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CHECK RESET TOKEN VALIDITY ====================

/**
 * Check if reset token is valid
 * GET /api/auth/check-reset-token?token=xxxx
 */
exports.checkResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token is required' 
      });
    }
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    res.json({
      success: true,
      message: 'Token is valid',
      email: user.email
    });
    
  } catch (error) {
    console.error('Check reset token error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== UPDATE REGISTRATION TO SUPPORT MOBILE ====================

exports.register = async (req, res) => {
  try {
    const { 
      name, email, password, role, contactNo, department, 
      organization, dateOfBirth, mobileVerified = false 
    } = req.body;

    console.log("📤 Register request:", { name, email, role, contactNo, mobileVerified });

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email and password are required" 
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "Email already registered" 
      });
    }

    // Check if mobile already exists (if provided)
    if (contactNo) {
      const cleanMobile = contactNo.replace(/\D/g, '');
      const existingMobile = await User.findOne({ 
        contactNo: { $regex: cleanMobile + '$', $options: 'i' } 
      });
      if (existingMobile) {
        return res.status(400).json({ 
          success: false, 
          message: "Mobile number already registered" 
        });
      }
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: password,
      role: role || "User",
      department: department || 'Purchase',
      contactNo: contactNo || '',
      organization: organization || 'Radiant Appliances',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      mobileVerified: mobileVerified, // Track if mobile is verified
      emailVerified: false,
      rights: {}
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        mobileVerified: user.mobileVerified,
        emailVerified: user.emailVerified,
        rights: user.rights || {}
      }
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== EMAIL FUNCTIONS ====================

const sendEmailWithResend = async (to, subject, html, text, ccList = []) => {
  const recipient = Array.isArray(to) ? to[0] : to;
  return sendMail({
    to: recipient,
    cc: ccList?.length ? ccList : undefined,
    subject,
    html,
    text: text || subject,
  });
};

const sendEmailOTPCode = async (email, name, otp, type, ccList = []) => {
  let subject = '';
  let title = '';
  
  switch(type) {
    case 'login':
      subject = 'Your Login OTP - LCGC RFQ';
      title = 'Login Verification';
      break;
    case 'registration':
      subject = 'Verify Your Email - LCGC RFQ';
      title = 'Email Verification';
      break;
    case 'reset':
      subject = 'Password Reset OTP - LCGC RFQ';
      title = 'Password Reset';
      break;
    default:
      subject = 'Your OTP - LCGC RFQ';
      title = 'OTP Verification';
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
        .content { padding: 30px; }
        .otp-box { background: #f8fafc; border: 2px dashed #cbd5e1; padding: 25px; text-align: center; border-radius: 12px; margin: 20px 0; }
        .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #0f2a5e; background: white; padding: 15px; border-radius: 10px; display: inline-block; font-family: monospace; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LCGC RFQ</h1>
          <p>Resolute Group</p>
        </div>
        <div class="content">
          <h2 style="color: #0f2a5e;">${title}</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your OTP is:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p style="margin-top: 10px; font-size: 12px;">This OTP is valid for <strong>10 minutes</strong></p>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} LCGC RFQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your OTP for ${title.toLowerCase()} is: ${otp}. Valid for 10 minutes.`;

  return await sendEmailWithResend(email, subject, html, text, ccList);
};

// ==================== REGISTRATION OTP ====================

exports.sendRegistrationOTP = async (req, res) => {
  try {
    const { email, ccEmails } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const otp = generateOTP();
    console.log(`🔐 Registration OTP for ${email}: ${otp}`);

    await saveOTP(email, null, otp, 'registration');

    let ccArray = [];
    if (ccEmails) {
      if (typeof ccEmails === 'string') {
        ccArray = ccEmails.split(',').map(e => e.trim()).filter(e => e);
      } else if (Array.isArray(ccEmails)) {
        ccArray = ccEmails.filter(e => e && e.trim());
      }
    }

    const name = email.split('@')[0];
    const mailResult = await sendEmailOTPCode(email, name, otp, 'registration', ccArray);
    if (!mailResult || mailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: mailResult?.error || 'Email could not be sent.',
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully to your email",
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error("Send Registration OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== VERIFY REGISTRATION OTP ====================

exports.verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp: otp,
      type: 'registration'
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (error) {
    console.error("Verify Registration OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEND EMAIL OTP (LOGIN) ====================

exports.sendEmailOTP = async (req, res) => {
  try {
    const { email, type = 'login', ccEmails } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user && (type === 'login' || type === 'reset')) {
      return res.status(404).json({ success: false, message: "Email not registered" });
    }

    const otp = generateOTP();
    console.log(`📧 Email OTP for ${email}: ${otp}`);

    await saveOTP(email, null, otp, type);

    let ccArray = [];
    if (ccEmails) {
      if (typeof ccEmails === 'string') {
        ccArray = ccEmails.split(',').map(e => e.trim()).filter(e => e);
      } else if (Array.isArray(ccEmails)) {
        ccArray = ccEmails.filter(e => e && e.trim());
      }
    }

    const name = user ? user.name : email.split('@')[0];
    const mailResult = await sendEmailOTPCode(email, name, otp, type, ccArray);
    if (!mailResult || mailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: mailResult?.error || 'Email could not be sent.',
        devOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
      });
    }

    res.json({
      success: true,
      message: `OTP sent to ${email}`,
      method: 'email',
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error("Send Email OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== VERIFY OTP ====================

exports.verifyOTP = async (req, res) => {
  try {
    const { email, mobile, otp, method = 'email', type = 'login' } = req.body;

    if (method === 'email') {
      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email and OTP are required" });
      }
    } else if (method === 'mobile') {
      if (!mobile || !otp) {
        return res.status(400).json({ success: false, message: "Mobile and OTP are required" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Invalid method" });
    }

    let user = null;

    if (method === 'email') {
      const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        otp: otp,
        type: type
      });

      if (!otpRecord) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      if (new Date() > otpRecord.expiresAt) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({ success: false, message: "OTP has expired" });
      }

      user = await User.findOne({ email: email.toLowerCase() });
      await OTP.deleteOne({ _id: otpRecord._id });
    } else {
      const result = await verifySmsOtp(mobile, otp);
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'SMS verify failed' });
      }
      if (!result.isValid) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }
      const cleanMobile = mobile.replace(/\D/g, '');
      user = await User.findOne({
        $or: [
          { contactNo: { $regex: cleanMobile + '$', $options: 'i' } },
          { phone: { $regex: cleanMobile + '$', $options: 'i' } },
        ],
      });
      await OTP.deleteMany({ mobile: mobile, type: type });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const token = generateToken(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    res.json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {}
      }
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SOCIAL LOGIN CALLBACK ====================

exports.socialLoginCallback = async (req, res) => {
  try {
    const { provider, profile } = req.body;
    const User = require('../models/user.model');
    
    const user = await User.findOrCreateSocialUser(provider, profile);
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, rights: user.rights || {} },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );
    
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    
    res.json({
      success: true,
      message: `${provider} login successful`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        emailVerified: user.emailVerified,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error(`${provider} login error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REGISTER USER ====================

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, contactNo, department, organization, dateOfBirth } = req.body;

    console.log("📤 Register request:", { name, email, role });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: password,
      role: role || "User",
      department: department || 'Purchase',
      contactNo: contactNo || '',
      organization: organization || 'Radiant Appliances',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      rights: {}
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {}
      }
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LOGIN ====================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("📤 Login request for:", email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!user.password || typeof user.password !== "string") {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    let match = false;
    try {
      match = await bcrypt.compare(password, user.password);
    } catch (err) {
      console.error("Login bcrypt error:", err.message);
      match = false;
    }
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user);
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {}
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET CURRENT USER ====================

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error("Get Me error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE PROFILE ====================

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, contactNo, department, organization, dateOfBirth, workspaces } = req.body;
    const user = await User.findById(req.user.id || req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (name) user.name = name.trim();
    if (email && email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists && String(exists._id) !== String(user._id)) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = email.toLowerCase();
    }
    if (contactNo !== undefined) user.contactNo = contactNo;
    if (department !== undefined) user.department = department;
    if (organization !== undefined) user.organization = organization;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (workspaces !== undefined) user.workspaces = Array.isArray(workspaces) ? workspaces : [];
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {},
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CHANGE PASSWORD ====================

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const user = await User.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      toast: 'success'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPLOAD PROFILE PHOTO ====================

exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    
    const profileImageUrl = `/uploads/profiles/${req.file.filename}`;
    const user = await User.findById(req.user.id || req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.profileImage = profileImageUrl;
    user.avatar = profileImageUrl;
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      profileImage: profileImageUrl,
      avatar: profileImageUrl,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {},
      },
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REFRESH USER SESSION ====================

exports.refreshUserSession = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const newToken = generateToken(user);
    
    res.json({
      success: true,
      message: "Session refreshed successfully",
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        profileImage: user.profileImage || '',
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {}
      }
    });
  } catch (error) {
    console.error("Refresh session error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET DEPARTMENTS ====================

exports.getDepartments = async (req, res) => {
  try {
    const departments = [
      'Purchase', 'IT', 'Finance', 'HR', 'Operations', 'Production',
      'Quality', 'Logistics', 'Sales', 'Marketing', 'R&D', 'Admin',
      'Legal', 'Supply Chain', 'Engineering'
    ];

    const userDepts = await User.distinct('department');
    const allDepts = [...new Set([...departments, ...userDepts.filter(Boolean)])].sort();

    res.json({
      success: true,
      departments: allDepts
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET MANAGERS ====================

exports.getManagers = async (req, res) => {
  try {
    const managers = await User.find(
      { role: { $in: ['Admin', 'Manager', 'VP', 'GM', 'Director', 'MD'] } },
      'name email role department'
    ).lean();

    const defaultApprovers = [
      { name: 'Vijay Parashar', email: 'vijay.parashar@radiant.com', designation: 'Manager', department: 'Purchase' },
      { name: 'Ravib', email: 'ravib@radiant.com', designation: 'A-GM', department: 'Operations' },
      { name: 'Shailendra Chothe', email: 'shailendra.chothe@radiant.com', designation: 'VP', department: 'Finance' },
      { name: 'Sanjay Munshi', email: 'sanjay.munshi@radiant.com', designation: 'S-VP', department: 'Operations' },
      { name: 'Wang Xianwen', email: 'wang.xianwen@radiant.com', designation: 'GM', department: 'General' },
      { name: 'Raminder Singh', email: 'raminder.singh@radiant.com', designation: 'MD', department: 'General' }
    ];

    res.json({
      success: true,
      managers: managers.length > 0 ? managers.map(m => ({
        name: m.name,
        email: m.email,
        designation: m.role,
        department: m.department
      })) : defaultApprovers,
      defaultApprovers
    });
  } catch (error) {
    console.error("Get managers error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FORGOT / RESET PASSWORD ====================

exports.sendForgotPasswordOTP = async (req, res) => {
  try {
    req.body.type = 'reset';
    return exports.sendEmailOTP(req, res);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.resendForgotPasswordOTP = async (req, res) => {
  return exports.sendForgotPasswordOTP(req, res);
};

exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP and new password required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Minimum 6 characters' });
    }
    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp, type: 'reset' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }
    await OTP.deleteOne({ _id: otpRecord._id });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successful. You can log in.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.sendForgotPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, reset instructions have been sent.' });
    }
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 3600000);
    await user.save({ validateBeforeSave: false });
    const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:4200';
    const link = `${base.replace(/\/$/, '')}/reset-password?token=${raw}`;
    const mailResult = await sendMail({
      to: user.email,
      subject: 'Password reset instructions',
      html: `<p>Hello ${user.name},</p><p><a href="${link}">Reset your password</a></p><p>${link}</p><p>Expires in 1 hour.</p>`,
      text: link,
    });
    if (!mailResult.success) {
      return res.status(502).json({
        success: false,
        message: mailResult.error || 'Email not configured or send failed.',
      });
    }
    res.json({ success: true, message: 'If an account exists, reset instructions have been sent.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Minimum 6 characters' });
    }
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hash,
      resetPasswordExpire: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({ success: true, message: 'Password updated. You can log in.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ==================== EMAIL VERIFICATION ====================

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token required' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    
    const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:4200';
    const verificationLink = `${base}/verify-email?token=${verificationToken}`;
    
    await sendMail({
      to: user.email,
      subject: 'Verify Your Email',
      html: `<p>Hello ${user.name},</p><p>Please verify your email by clicking: <a href="${verificationLink}">Verify Email</a></p>`,
    });
    
    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CHECK RESET TOKEN ====================
exports.checkResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    const User = require('../models/user.model');
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token required' });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    
    res.json({ success: true, message: 'Token is valid', email: user.email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEND SMS OTP ====================
exports.sendSmsOTP = async (req, res) => {
  try {
    const { mobile, type = 'login' } = req.body;
    
    console.log('📱 Send SMS OTP request:', { mobile, type });
    
    if (!mobile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number is required' 
      });
    }
    
    const cleanMobile = mobile.replace(/\D/g, '');
    
    if (type === 'login') {
      const User = require('../models/user.model');
      const existingUser = await User.findOne({ 
        contactNo: { $regex: cleanMobile + '$', $options: 'i' } 
      });
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'Mobile number not registered' 
        });
      }
    }
    
    const otp = generateOTP();
    console.log(`🔐 SMS OTP for ${mobile}: ${otp}`);
    
    await saveOTP(null, cleanMobile, otp, type);
    
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        message: `OTP sent to ${mobile}`,
        method: 'mobile',
        devOTP: otp,
        twilioStatus: 'development'
      });
    }
    
    const { sendSmsOtp } = require('../services/twilio.service');
    const result = await sendSmsOtp(mobile);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        message: result.error || 'Failed to send SMS' 
      });
    }
    
    res.json({
      success: true,
      message: `OTP sent to ${mobile}`,
      method: 'mobile',
      status: result.status
    });
    
  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ==================== CLEAR AVATAR ====================

exports.clearAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id);
    if (user) {
      user.profileImage = '';
      user.avatar = '';
      await user.save();
    }
    res.json({ 
      success: true, 
      message: 'Avatar removed successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: '',
        role: user.role,
        department: user.department,
        contactNo: user.contactNo,
        organization: user.organization,
        workspaces: user.workspaces || [],
        dateOfBirth: user.dateOfBirth,
        rights: user.rights || {},
      }
    });
  } catch (error) {
    console.error('Clear avatar error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EP REQUEST METHODS ====================

exports.createEPRequest = async (req, res) => {
  try {
    const {
      requester, department, email, contactNo, organization,
      title, amount, vendor, priority, description, objective,
      requestDate, stakeholders, ccList, attachments
    } = req.body;

    if (!title || !amount || !vendor || !email) {
      return res.status(400).json({ success: false, message: "Title, amount, vendor and email are required" });
    }

    const validStakeholders = (stakeholders || []).filter(s => s.name && s.email);
    const initialStatus = validStakeholders.length > 0 ? 'In-Process' : 'Pending';

    let epRequest;
    try {
      epRequest = new EPRequest({
        requester: requester || '',
        department: department || '',
        email: email || '',
        contactNo: contactNo || '',
        organization: organization || 'Radiant Appliances',
        title,
        amount: Number(amount),
        vendor,
        priority: priority || 'Medium',
        description: description || '',
        objective: objective || '',
        requestDate: requestDate || new Date().toISOString().split('T')[0],
        status: initialStatus,
        stakeholders: validStakeholders.map((s, i) => ({
          ...s,
          approvalOrder: s.approvalOrder || i + 1,
          status: 'Pending'
        })),
        ccList: ccList || [],
        attachments: (attachments || []).map(att => ({
          name: att.name,
          fileSize: att.fileSize,
          remark: att.remark,
          fileUrl: att.fileUrl || ''
        })),
        createdBy: req.user ? req.user.id : null
      });
      await epRequest.save();
    } catch (modelErr) {
      console.error('EPRequest model error:', modelErr);
      return res.status(500).json({ success: false, message: 'EP Request model not found.' });
    }

    try {
      await sendEpMailWithPdf(
        epRequest,
        `EP Approval Request: ${title} - ${requester || email}`,
        `EP: ${title} — ${initialStatus}`
      );
    } catch (notifyErr) {
      console.error('EP create notify:', notifyErr.message);
    }

    res.status(201).json({
      success: true,
      message: `EP Request created successfully!`,
      data: { ...epRequest.toObject(), id: epRequest._id }
    });

  } catch (error) {
    console.error("Create EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllEPRequests = async (req, res) => {
  try {
    const { department, status, priority, startDate, endDate, vendor } = req.query;

    let filter = {};
    if (department) filter.department = { $regex: department, $options: 'i' };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (vendor) filter.vendor = { $regex: vendor, $options: 'i' };
    if (startDate || endDate) {
      filter.requestDate = {};
      if (startDate) filter.requestDate.$gte = startDate;
      if (endDate) filter.requestDate.$lte = endDate;
    }

    const epRequests = await EPRequest.find(filter).sort({ createdAt: -1 }).lean();

    const data = epRequests.map(req => ({
      ...req,
      id: req._id
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("Get EP Requests error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEPRequestById = async (req, res) => {
  try {
    const epRequest = await EPRequest.findById(req.params.id).lean();
    if (!epRequest) {
      return res.status(404).json({ success: false, message: "EP Request not found" });
    }
    res.json({ success: true, data: { ...epRequest, id: epRequest._id } });
  } catch (error) {
    console.error("Get EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEPRequest = async (req, res) => {
  try {
    const epRequest = await EPRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!epRequest) {
      return res.status(404).json({ success: false, message: "EP Request not found" });
    }

    res.json({ success: true, message: "EP Request updated successfully", data: epRequest });
  } catch (error) {
    console.error("Update EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEPRequest = async (req, res) => {
  try {
    const epRequest = await EPRequest.findByIdAndDelete(req.params.id);
    if (!epRequest) {
      return res.status(404).json({ success: false, message: "EP Request not found" });
    }
    res.json({ success: true, message: "EP Request deleted successfully" });
  } catch (error) {
    console.error("Delete EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveEPRequest = async (req, res) => {
  try {
    const { comments = '' } = req.body;
    const actor = req.user;
    const epRequest = await EPRequest.findById(req.params.id);
    if (!epRequest) {
      return res.status(404).json({ success: false, message: "EP Request not found" });
    }
    if (['Approved', 'Rejected'].includes(epRequest.status)) {
      return res.status(400).json({ success: false, message: "Request already finalized" });
    }
    if (!canActOnEpRequest(actor, epRequest)) {
      return res.status(403).json({ success: false, message: "Not authorized to approve this request" });
    }
    const nowIso = new Date().toISOString();
    const label = actor.name || actor.email || 'Approver';
    epRequest.stakeholders.forEach((s) => {
      if (s.status === 'Pending' || s.status === 'In-Process') {
        s.status = 'Approved';
        s.remarks = comments ? `${label}: ${comments}` : `${label}: Approved`;
        s.dateTime = nowIso;
      }
    });
    epRequest.status = 'Approved';
    epRequest.approvedBy = label;
    epRequest.approvedAt = new Date();
    epRequest.approvalComments = comments;
    await epRequest.save();

    try {
      await sendEpMailWithPdf(
        epRequest,
        `EP Approved: ${epRequest.title}`,
        `Approved by ${label}`
      );
    } catch (e) {
      console.error('EP approve notify:', e.message);
    }

    res.json({
      success: true,
      toast: 'success',
      message: 'Request approved.',
      data: epRequest,
    });
  } catch (error) {
    console.error("Approve EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.rejectEPRequest = async (req, res) => {
  try {
    const { comments = '' } = req.body;
    const actor = req.user;
    const epRequest = await EPRequest.findById(req.params.id);
    if (!epRequest) {
      return res.status(404).json({ success: false, message: "EP Request not found" });
    }
    if (['Approved', 'Rejected'].includes(epRequest.status)) {
      return res.status(400).json({ success: false, message: "Request already finalized" });
    }
    if (!canActOnEpRequest(actor, epRequest)) {
      return res.status(403).json({ success: false, message: "Not authorized to reject this request" });
    }
    const nowIso = new Date().toISOString();
    const label = actor.name || actor.email || 'Approver';
    epRequest.stakeholders.forEach((s) => {
      if (s.status === 'Pending' || s.status === 'In-Process') {
        s.status = 'Rejected';
        s.remarks = comments ? `${label}: ${comments}` : `${label}: Rejected`;
        s.dateTime = nowIso;
      }
    });
    epRequest.status = 'Rejected';
    epRequest.rejectionReason = comments;
    epRequest.rejectedBy = label;
    epRequest.rejectedAt = new Date();
    await epRequest.save();

    try {
      await sendEpMailWithPdf(
        epRequest,
        `EP Rejected: ${epRequest.title}`,
        `Rejected by ${label}`
      );
    } catch (e) {
      console.error('EP reject notify:', e.message);
    }

    res.json({
      success: true,
      toast: 'error',
      message: 'Request rejected.',
      data: epRequest,
    });
  } catch (error) {
    console.error("Reject EP Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEPRequestStats = async (req, res) => {
  try {
    const total = await EPRequest.countDocuments();
    const pending = await EPRequest.countDocuments({ status: 'Pending' });
    const approved = await EPRequest.countDocuments({ status: 'Approved' });
    const rejected = await EPRequest.countDocuments({ status: 'Rejected' });
    const inProcess = await EPRequest.countDocuments({ status: 'In-Process' });

    const departmentStats = await EPRequest.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: { total, pending, approved, rejected, inProcess },
      departmentStats
    });
  } catch (error) {
    console.error("Get EP stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendEPRequestEmail = async (req, res) => {
  try {
    const { toEmails, ccEmails, epData } = req.body;

    if (!toEmails || !toEmails.length) {
      return res.status(400).json({ success: false, message: "Recipient emails required" });
    }

    const emailHtml = generateEPApprovalEmailHTML(epData);
    const emailText = `EP Approval Request: ${epData.title} | Amount: INR ${Number(epData.amount || 0).toLocaleString('en-IN')}`;
    let pdf;
    try {
      pdf = await buildEpPdfBuffer(epData);
    } catch (e) {
      console.error('EP PDF:', e.message);
    }

    const list = Array.isArray(toEmails) ? toEmails : [toEmails];
    const results = [];
    for (const toEmail of list) {
      const result = await sendMail({
        to: toEmail,
        cc: ccEmails?.length ? ccEmails : undefined,
        subject: `EP Approval Request: ${epData.title}`,
        html: emailHtml,
        text: emailText,
        attachments: pdf
          ? [{ filename: 'EP-approval.pdf', content: pdf, contentType: 'application/pdf' }]
          : [],
      });
      results.push({ email: toEmail, ...result });
    }

    res.json({
      success: true,
      message: `Email with PDF sent to ${list.length} recipient(s)`,
      results
    });
  } catch (error) {
    console.error("Send EP email error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};