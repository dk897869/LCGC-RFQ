const { Resend } = require('resend');
const nodemailer = require('nodemailer');

let resendClient = null;
let smtpTransporter = null;

// Initialize Gmail SMTP Transporter
function getSMTPTransporter() {
  if (smtpTransporter) return smtpTransporter;
  
  if (process.env.SMTP_ENABLED === 'true' && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
    
    smtpTransporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP Connection Error:', error.message);
      } else {
        console.log('✅ SMTP is ready to send emails');
      }
    });
  }
  
  return smtpTransporter;
}

function getFromAddress() {
  if (process.env.SMTP_ENABLED === 'true' && process.env.SMTP_FROM) {
    return process.env.SMTP_FROM;
  }
  return process.env.FROM_EMAIL || 'noreply@lcgc.com';
}

function getFromName() {
  return process.env.RESEND_FROM_NAME || 'LCGC System';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

// OTP Email Template
function getOTPEmailHTML(name, otp, type) {
  let title = '';
  let subjectPrefix = '';
  
  switch(type) {
    case 'login':
      title = 'Login Verification';
      subjectPrefix = 'Your Login OTP';
      break;
    case 'registration':
      title = 'Email Verification';
      subjectPrefix = 'Verify Your Email';
      break;
    case 'reset':
      title = 'Password Reset';
      subjectPrefix = 'Password Reset OTP';
      break;
    case 'email_verification':
      title = 'Email Verification';
      subjectPrefix = 'Verify Your Email Address';
      break;
    default:
      title = 'OTP Verification';
      subjectPrefix = 'Your OTP';
  }
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectPrefix} - LCGC</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { padding: 30px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 20px; }
    .otp-box { background: #f8fafc; border: 2px dashed #cbd5e1; padding: 25px; text-align: center; border-radius: 12px; margin: 20px 0; }
    .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #0f2a5e; background: white; padding: 15px 25px; border-radius: 10px; display: inline-block; font-family: monospace; }
    .expiry-text { font-size: 12px; color: #64748b; margin-top: 12px; }
    .button { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 20px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400e; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LCGC System</h1>
      <p>Resolute Group</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hello <strong>${escapeHtml(name)}</strong>,
      </div>
      <h2 style="color: #0f2a5e;">${title}</h2>
      <p>Please use the following One-Time Password (OTP) to complete your ${type === 'login' ? 'login' : type === 'registration' ? 'registration' : 'password reset'} process:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="expiry-text">⏰ This OTP is valid for <strong>10 minutes</strong></div>
      </div>
      <p>If you didn't request this, please ignore this email.</p>
      <div class="warning">
        ⚠️ For security reasons, never share this OTP with anyone.
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} LCGC System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Email Verification Link Template
function getEmailVerificationLinkHTML(name, verificationLink) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - LCGC</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { padding: 30px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 20px; }
    .verify-box { background: #f8fafc; padding: 25px; text-align: center; border-radius: 12px; margin: 20px 0; }
    .verify-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669, #047857); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; font-size: 16px; margin: 10px 0; }
    .expiry-text { font-size: 12px; color: #64748b; margin-top: 12px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 20px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400e; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LCGC System</h1>
      <p>Resolute Group</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hello <strong>${escapeHtml(name)}</strong>,
      </div>
      <h2 style="color: #0f2a5e;">Verify Your Email Address</h2>
      <p>Thank you for registering with LCGC System. Please verify your email address to complete your registration and start using the platform.</p>
      <div class="verify-box">
        <p>Click the button below to verify your email:</p>
        <a href="${verificationLink}" class="verify-button">✓ Verify Email Address</a>
        <div class="expiry-text">⏰ This verification link is valid for <strong>24 hours</strong></div>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 12px; color: #3b82f6;">${verificationLink}</p>
      <div class="warning">
        ⚠️ If you didn't create an account with LCGC, please ignore this email.
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} LCGC System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Welcome Email Template (After Verification)
function getWelcomeEmailHTML(name) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to LCGC - Account Verified!</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; }
    .content { padding: 30px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 20px; }
    .features { display: flex; gap: 20px; margin: 30px 0; flex-wrap: wrap; }
    .feature { flex: 1; text-align: center; padding: 20px; background: #f8fafc; border-radius: 12px; }
    .feature-icon { font-size: 32px; margin-bottom: 10px; }
    .feature-title { font-weight: 700; color: #0f2a5e; margin-bottom: 5px; }
    .feature-desc { font-size: 12px; color: #64748b; }
    .button { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to LCGC!</h1>
      <p>Your account has been verified</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hello <strong>${escapeHtml(name)}</strong>,
      </div>
      <h2 style="color: #0f2a5e;">🎉 Your Email Has Been Verified!</h2>
      <p>Thank you for verifying your email address. Your account is now fully activated and you can start using the LCGC Procurement System.</p>
      
      <div class="features">
        <div class="feature">
          <div class="feature-icon">📋</div>
          <div class="feature-title">EP Approvals</div>
          <div class="feature-desc">Submit and track approval requests</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🛒</div>
          <div class="feature-title">RFQ Management</div>
          <div class="feature-desc">Create and manage RFQs</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🏢</div>
          <div class="feature-title">Vendor Portal</div>
          <div class="feature-desc">Manage vendor relationships</div>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard" class="button">🚀 Go to Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} LCGC System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// RFQ Email Template
function getRFQEmailHTML(data, action) {
  const title = data.titleOfActivity || 'RFQ Request';
  const requester = data.requesterName || data.requester || 'User';
  const department = data.department || '—';
  const amount = data.estimatedAmount || data.amount || 0;
  const priorityValue = data.priority === 'H' ? 'High' : data.priority === 'M' ? 'Medium' : 'Low';
  const serialNo = data.uniqueSerialNo || data._id || '';
  
  const headerIcon = action === 'created' ? '📋' : action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '⚠️';
  const headerTitle = action === 'created' ? 'New RFQ Created' : action === 'approved' ? 'RFQ Approved' : action === 'rejected' ? 'RFQ Rejected' : 'Action Required';
  
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:4200';
  const approveUrl = `${baseUrl}/dashboard`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; padding: 40px 20px; margin: 0; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); padding: 40px; text-align: center; }
    .header-icon { font-size: 48px; }
    .header h1 { color: white; font-size: 28px; margin: 16px 0 8px; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .section-title { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #0f2a5e; border-bottom: 1px solid #e2e8f0; }
    .section-body { padding: 20px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #0f172a; font-weight: 500; }
    .amount-box { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #1e40af; }
    .serial-badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) { .content { padding: 24px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">${headerIcon}</div>
      <h1>${headerTitle}</h1>
      <p>RFQ ${action === 'created' ? 'Submitted' : action === 'approved' ? 'Approved' : 'Action Required'}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">📋 RFQ Information</div>
        <div class="section-body">
          <div class="info-grid">
            <div class="info-item"><label>Serial Number</label><span class="serial-badge">${escapeHtml(serialNo)}</span></div>
            <div class="info-item"><label>Status</label><span>${data.status || 'Pending'}</span></div>
            <div class="info-item"><label>Title</label><span>${escapeHtml(title)}</span></div>
            <div class="info-item"><label>Priority</label><span>${priorityValue}</span></div>
            <div class="info-item"><label>Requester</label><span>${escapeHtml(requester)}</span></div>
            <div class="info-item"><label>Department</label><span>${escapeHtml(department)}</span></div>
            <div class="info-item"><label>Email</label><span>${escapeHtml(data.emailId || data.email)}</span></div>
            <div class="info-item"><label>Request Date</label><span>${data.requestDate || new Date().toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-value">₹${Number(amount).toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Estimated Amount</div>
      </div>
      
      <div style="text-align: center;">
        <a href="${approveUrl}" class="btn">🔍 View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// EP Approval Email Template
function getEPEmailHTML(data, action) {
  const title = data.title || 'EP Request';
  const requester = data.requester || data.requesterName || 'User';
  const department = data.department || '—';
  const amount = data.amount || 0;
  const priorityValue = data.priority || 'Medium';
  const serialNo = data.uniqueSerialNo || data._id || '';
  
  const headerIcon = action === 'created' ? '📋' : action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '⚠️';
  const headerTitle = action === 'created' ? 'New EP Request Created' : action === 'approved' ? 'EP Request Approved' : action === 'rejected' ? 'EP Request Rejected' : 'Action Required';
  
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:4200';
  const approveUrl = `${baseUrl}/dashboard`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; padding: 40px 20px; margin: 0; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); padding: 40px; text-align: center; }
    .header-icon { font-size: 48px; }
    .header h1 { color: white; font-size: 28px; margin: 16px 0 8px; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .section-title { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #0f2a5e; border-bottom: 1px solid #e2e8f0; }
    .section-body { padding: 20px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #0f172a; font-weight: 500; }
    .amount-box { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #1e40af; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) { .content { padding: 24px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">${headerIcon}</div>
      <h1>${headerTitle}</h1>
      <p>EP Request ${action === 'created' ? 'Submitted' : action === 'approved' ? 'Approved' : 'Action Required'}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">📋 Request Information</div>
        <div class="section-body">
          <div class="info-grid">
            <div class="info-item"><label>Serial Number</label><span class="serial-badge">${escapeHtml(serialNo)}</span></div>
            <div class="info-item"><label>Status</label><span>${data.status || 'Pending'}</span></div>
            <div class="info-item"><label>Title</label><span>${escapeHtml(title)}</span></div>
            <div class="info-item"><label>Priority</label><span>${priorityValue}</span></div>
            <div class="info-item"><label>Requester</label><span>${escapeHtml(requester)}</span></div>
            <div class="info-item"><label>Department</label><span>${escapeHtml(department)}</span></div>
            <div class="info-item"><label>Email</label><span>${escapeHtml(data.email)}</span></div>
            <div class="info-item"><label>Request Date</label><span>${data.requestDate || new Date().toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-value">₹${Number(amount).toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Total Amount</div>
      </div>
      
      <div style="text-align: center;">
        <a href="${approveUrl}" class="btn">🔍 View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// PR NPP Email Template
function getPRNppEmailHTML(data, action) {
  const title = data.titleOfActivity || 'PR Request';
  const requester = data.requesterName || 'User';
  const department = data.department || '—';
  const amount = data.amount || 0;
  const priorityValue = data.priority === 'H' ? 'High' : data.priority === 'M' ? 'Medium' : 'Low';
  const serialNo = data.uniqueSerialNo || '';
  
  const headerIcon = action === 'created' ? '📋' : action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '⚠️';
  const headerTitle = action === 'created' ? 'New PR Request Created' : action === 'approved' ? 'PR Request Approved' : action === 'rejected' ? 'PR Request Rejected' : 'Action Required';
  
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:4200';
  const approveUrl = `${baseUrl}/dashboard`;
  
  let prTotalValue = 0;
  const itemsHtml = (data.items || []).map((item, idx) => {
    const total = (item.qty || 0) * (item.unitPrice || 0);
    prTotalValue += total;
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px;">${idx + 1}</td>
      <td style="padding: 8px;"><strong>${escapeHtml(item.partDescription)}</strong></td>
      <td style="padding: 8px;">${item.partCode || '—'}</td>
      <td style="padding: 8px;">${item.qty || 0}</td>
      <td style="padding: 8px;">₹${(item.unitPrice || 0).toLocaleString('en-IN')}</td>
      <td style="padding: 8px;">₹${total.toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; padding: 40px 20px; margin: 0; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); padding: 40px; text-align: center; }
    .header-icon { font-size: 48px; }
    .header h1 { color: white; font-size: 28px; margin: 16px 0 8px; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .section-title { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #0f2a5e; border-bottom: 1px solid #e2e8f0; }
    .section-body { padding: 20px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #0f172a; font-weight: 500; }
    .amount-box { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #1e40af; }
    .serial-badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) { .content { padding: 24px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">${headerIcon}</div>
      <h1>${headerTitle}</h1>
      <p>PR Request ${action === 'created' ? 'Submitted' : action === 'approved' ? 'Approved' : 'Action Required'}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">📋 PR Information</div>
        <div class="section-body">
          <div class="info-grid">
            <div class="info-item"><label>Serial Number</label><span class="serial-badge">${escapeHtml(serialNo)}</span></div>
            <div class="info-item"><label>Status</label><span>${data.status || 'Pending'}</span></div>
            <div class="info-item"><label>Title</label><span>${escapeHtml(title)}</span></div>
            <div class="info-item"><label>Priority</label><span>${priorityValue}</span></div>
            <div class="info-item"><label>Requester</label><span>${escapeHtml(requester)}</span></div>
            <div class="info-item"><label>Department</label><span>${escapeHtml(department)}</span></div>
            <div class="info-item"><label>Vendor</label><span>${escapeHtml(data.vendor || '—')}</span></div>
          </div>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-value">₹${Number(amount).toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Total Amount</div>
      </div>
      
      ${data.items && data.items.length > 0 ? `
      <div class="section">
        <div class="section-title">📦 Items</div>
        <div class="section-body" style="overflow-x: auto;">
          <table style="width: 100%;">
            <thead><tr><th>#</th><th>Description</th><th>Part Code</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr style="background: #f8fafc;"><td colspan="5" style="text-align: right;"><strong>Total Value:</strong></td><td><strong>₹${prTotalValue.toLocaleString('en-IN')}</strong></td></tr></tfoot>
          </table>
        </div>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${approveUrl}" class="btn">🔍 View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// PO NPP Email Template
function getPONppEmailHTML(data, action) {
  const title = data.orderNo || data.titleOfActivity || 'PO Request';
  const requester = data.purchaser || data.requesterName || 'User';
  const department = data.department || '—';
  const serialNo = data.uniqueSerialNo || '';
  
  const headerIcon = action === 'created' ? '📋' : action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '⚠️';
  const headerTitle = action === 'created' ? 'New PO Created' : action === 'approved' ? 'PO Approved' : action === 'rejected' ? 'PO Rejected' : 'Action Required';
  
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:4200';
  const approveUrl = `${baseUrl}/dashboard`;
  
  let poTotalValue = 0;
  const itemsHtml = (data.items || []).map((item, idx) => {
    const base = (item.qty || 0) * (item.unitPrice || 0);
    const gst = base * ((item.cgst || 0) + (item.sgst || 0)) / 100;
    const total = base + gst;
    poTotalValue += total;
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px;">${idx + 1}</td>
      <td style="padding: 8px;"><strong>${escapeHtml(item.partDescription)}</strong></td>
      <td style="padding: 8px;">${item.partCode || '—'}</td>
      <td style="padding: 8px;">${item.qty || 0}</td>
      <td style="padding: 8px;">₹${(item.unitPrice || 0).toLocaleString('en-IN')}</td>
      <td style="padding: 8px;">₹${total.toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; padding: 40px 20px; margin: 0; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); padding: 40px; text-align: center; }
    .header-icon { font-size: 48px; }
    .header h1 { color: white; font-size: 28px; margin: 16px 0 8px; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .section-title { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #0f2a5e; border-bottom: 1px solid #e2e8f0; }
    .section-body { padding: 20px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #0f172a; font-weight: 500; }
    .amount-box { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #1e40af; }
    .serial-badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) { .content { padding: 24px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">${headerIcon}</div>
      <h1>${headerTitle}</h1>
      <p>Purchase Order ${action === 'created' ? 'Created' : action === 'approved' ? 'Approved' : 'Action Required'}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">📋 PO Information</div>
        <div class="section-body">
          <div class="info-grid">
            <div class="info-item"><label>Serial Number</label><span class="serial-badge">${escapeHtml(serialNo)}</span></div>
            <div class="info-item"><label>PO Number</label><span>${escapeHtml(data.orderNo || '—')}</span></div>
            <div class="info-item"><label>Status</label><span>${data.status || 'Pending'}</span></div>
            <div class="info-item"><label>Vendor</label><span>${escapeHtml(data.vendorName || '—')}</span></div>
            <div class="info-item"><label>Requester</label><span>${escapeHtml(requester)}</span></div>
            <div class="info-item"><label>Department</label><span>${escapeHtml(department)}</span></div>
          </div>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-value">₹${Number(poTotalValue).toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Grand Total (Incl. GST)</div>
      </div>
      
      ${data.items && data.items.length > 0 ? `
      <div class="section">
        <div class="section-title">📦 Order Items</div>
        <div class="section-body" style="overflow-x: auto;">
          <table style="width: 100%;">
            <thead><tr><th>#</th><th>Description</th><th>Part Code</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr style="background: #f8fafc;"><td colspan="5" style="text-align: right;"><strong>Grand Total:</strong></td><td style="text-align: right;"><strong>₹${poTotalValue.toLocaleString('en-IN')}</strong></td></tr></tfoot>
          </table>
        </div>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${approveUrl}" class="btn">🔍 View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Payment NPP Email Template
function getPaymentNppEmailHTML(data, action) {
  const title = data.titleOfActivity || data.paymentTo || 'Payment Request';
  const requester = data.requesterName || 'User';
  const department = data.department || '—';
  const amount = data.amount || Number(data.expenseAmount) || 0;
  const serialNo = data.uniqueSerialNo || '';
  
  const headerIcon = action === 'created' ? '📋' : action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '⚠️';
  const headerTitle = action === 'created' ? 'New Payment Advice Created' : action === 'approved' ? 'Payment Advice Approved' : action === 'rejected' ? 'Payment Advice Rejected' : 'Action Required';
  
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:4200';
  const approveUrl = `${baseUrl}/dashboard`;
  
  let invoiceTotal = 0;
  const invoicesHtml = (data.invoices || []).map((inv, idx) => {
    invoiceTotal += (inv.invoiceValue || 0);
    return `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px;">${idx + 1}</td>
      <td style="padding: 8px;">${escapeHtml(inv.invoiceNo || '—')}</td>
      <td style="padding: 8px;">${inv.invoiceDate || '—'}</td>
      <td style="padding: 8px;">₹${(inv.invoiceValue || 0).toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f4f8; padding: 40px 20px; margin: 0; }
    .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); padding: 40px; text-align: center; }
    .header-icon { font-size: 48px; }
    .header h1 { color: white; font-size: 28px; margin: 16px 0 8px; }
    .header p { color: rgba(255,255,255,0.9); margin: 0; }
    .content { padding: 40px; }
    .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .section-title { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #0f2a5e; border-bottom: 1px solid #e2e8f0; }
    .section-body { padding: 20px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .info-item label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #0f172a; font-weight: 500; }
    .amount-box { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-value { font-size: 32px; font-weight: 800; color: #1e40af; }
    .serial-badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 40px; font-weight: 600; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    @media (max-width: 600px) { .content { padding: 24px; } .info-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-icon">${headerIcon}</div>
      <h1>${headerTitle}</h1>
      <p>Payment Advice ${action === 'created' ? 'Submitted' : action === 'approved' ? 'Approved' : 'Action Required'}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">💰 Payment Information</div>
        <div class="section-body">
          <div class="info-grid">
            <div class="info-item"><label>Serial Number</label><span class="serial-badge">${escapeHtml(serialNo)}</span></div>
            <div class="info-item"><label>Status</label><span>${data.status || 'Pending'}</span></div>
            <div class="info-item"><label>Payment To</label><span>${escapeHtml(data.paymentTo || '—')}</span></div>
            <div class="info-item"><label>Requester</label><span>${escapeHtml(requester)}</span></div>
            <div class="info-item"><label>Department</label><span>${escapeHtml(department)}</span></div>
            <div class="info-item"><label>Bank Details</label><span>${escapeHtml(data.bankDetails || '—')}</span></div>
          </div>
        </div>
      </div>
      
      <div class="amount-box">
        <div class="amount-value">₹${Number(amount).toLocaleString('en-IN')}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Payment Amount</div>
      </div>
      
      ${data.invoices && data.invoices.length > 0 ? `
      <div class="section">
        <div class="section-title">📄 Invoices</div>
        <div class="section-body" style="overflow-x: auto;">
          <table style="width: 100%;">
            <thead><tr><th>#</th><th>Invoice No.</th><th>Date</th><th>Value</th></tr></thead>
            <tbody>${invoicesHtml}</tbody>
            <tfoot><tr style="background: #f8fafc;"><td colspan="3" style="text-align: right;"><strong>Total:</strong></td><td style="text-align: right;"><strong>₹${invoiceTotal.toLocaleString('en-IN')}</strong></td></tr></tfoot>
          </table>
        </div>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${approveUrl}" class="btn">🔍 View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Approval Status Email Template
function getApprovalEmailHTML(data, type, action, comments) {
  const title = data.title || data.titleOfActivity || 'Request';
  const requester = data.requester || data.requesterName || 'User';
  const serialNo = data.uniqueSerialNo || data._id || '';
  
  const statusColor = action === 'Approved' ? '#10b981' : '#ef4444';
  const statusText = action === 'Approved' ? '✅ APPROVED' : '❌ REJECTED';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LCGC - ${escapeHtml(title)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f7fc; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .status-badge { display: inline-block; padding: 8px 20px; border-radius: 30px; font-weight: bold; margin-top: 15px; background: ${statusColor}; color: white; }
    .content { padding: 30px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .info-table td:first-child { font-weight: bold; width: 40%; color: #475569; }
    .info-table td:last-child { color: #1e293b; }
    .comments-box { background: #f8fafc; padding: 16px; border-radius: 12px; margin-top: 20px; border-left: 4px solid ${statusColor}; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    .btn { display: inline-block; padding: 12px 24px; background: #0f2a5e; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LCGC System</h1>
      <div class="status-badge">${statusText}</div>
    </div>
    <div class="content">
      <h2>${type.toUpperCase()} Request ${action}</h2>
      <table class="info-table">
        <tr><td>Serial Number</td><td>${escapeHtml(serialNo)}</td></tr>
        <tr><td>Title</td><td>${escapeHtml(title)}</td></tr>
        <tr><td>Requester</td><td>${escapeHtml(requester)}</td></tr>
      </table>
      ${comments ? `<div class="comments-box"><strong>📝 Comments:</strong><br>${escapeHtml(comments)}</div>` : ''}
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard" class="btn">View in Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from LCGC System</p>
      <p>© ${new Date().getFullYear()} LCGC. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Main send mail function
async function sendMail(opts) {
  const { to, cc, bcc, subject, html, text, attachments, type, action, data, comments } = opts;
  
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];
  const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean) : [];
  
  if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) {
    console.error('❌ No recipients specified');
    return { success: false, error: 'No recipients specified' };
  }

  let finalHtml = html;
  let finalText = text;
  
  if (!finalHtml && data) {
    if (type === 'otp') {
      finalHtml = getOTPEmailHTML(data.name || data.email?.split('@')[0] || 'User', data.otp, data.otpType || 'login');
    } else if (type === 'email_verification') {
      finalHtml = getEmailVerificationLinkHTML(data.name, data.verificationLink);
    } else if (type === 'welcome') {
      finalHtml = getWelcomeEmailHTML(data.name);
    } else if (type === 'rfq') {
      finalHtml = getRFQEmailHTML(data, action || 'created');
    } else if (type === 'ep') {
      finalHtml = getEPEmailHTML(data, action || 'created');
    } else if (type === 'pr') {
      finalHtml = getPRNppEmailHTML(data, action || 'created');
    } else if (type === 'po') {
      finalHtml = getPONppEmailHTML(data, action || 'created');
    } else if (type === 'payment') {
      finalHtml = getPaymentNppEmailHTML(data, action || 'created');
    } else if (type === 'approval') {
      finalHtml = getApprovalEmailHTML(data, data.requestType || 'request', action || 'Approved', comments);
    }
  }

  if (!finalHtml) {
    finalHtml = `<html><body><h2>${subject}</h2><p>${finalText || 'No content available'}</p></body></html>`;
  }

  const from = getFromAddress();
  const fromName = getFromName();

  const mailOptions = {
    from: `"${fromName}" <${from}>`,
    to: toList.join(', '),
    subject: subject,
    html: finalHtml,
  };
  
  if (finalText) mailOptions.text = finalText;
  if (ccList.length > 0) mailOptions.cc = ccList.join(', ');
  if (bccList.length > 0) mailOptions.bcc = bccList.join(', ');
  if (attachments && attachments.length > 0) mailOptions.attachments = attachments;

  const smtpTransporter = getSMTPTransporter();
  
  if (smtpTransporter && process.env.SMTP_ENABLED === 'true') {
    try {
      console.log(`📧 Sending email via SMTP to: ${toList.join(', ')}`);
      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`✅ Email sent! Message ID: ${info.messageId}`);
      return { success: true, via: 'smtp', messageId: info.messageId };
    } catch (error) {
      console.error('❌ SMTP error:', error.message);
      
      if (process.env.RESEND_API_KEY) {
        try {
          if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
          
          const resendPayload = {
            from: `${fromName} <${from}>`,
            to: toList,
            subject: subject,
            html: finalHtml,
          };
          
          if (ccList.length > 0) resendPayload.cc = ccList;
          if (bccList.length > 0) resendPayload.bcc = bccList;
          if (attachments && attachments.length > 0) resendPayload.attachments = attachments;
          
          const { data: resendData, error: resendError } = await resendClient.emails.send(resendPayload);
          
          if (resendError) {
            console.error('❌ Resend error:', resendError);
            return { success: false, error: resendError.message };
          }
          
          console.log(`✅ Email sent via Resend! ID: ${resendData?.id}`);
          return { success: true, via: 'resend', id: resendData?.id };
        } catch (resendErr) {
          console.error('❌ Resend fallback error:', resendErr.message);
        }
      }
      
      return { success: false, error: error.message };
    }
  }
  
  // Fallback: Log to console
  console.warn('⚠️ No email provider configured. Logging to console.');
  console.log('='.repeat(80));
  console.log('📧 EMAIL NOTIFICATION');
  console.log('='.repeat(80));
  console.log(`TO: ${toList.join(', ')}`);
  if (ccList.length > 0) console.log(`CC: ${ccList.join(', ')}`);
  if (bccList.length > 0) console.log(`BCC: ${bccList.join(', ')}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`TYPE: ${type || 'general'}`);
  if (data) console.log(`DATA:`, JSON.stringify(data, null, 2));
  console.log('='.repeat(80));
  
  return { success: true, method: 'console', message: 'Email logged to console' };
}

module.exports = { 
  sendMail, 
  getFromAddress, 
  getOTPEmailHTML, 
  getEmailVerificationLinkHTML,
  getWelcomeEmailHTML,
  getRFQEmailHTML, 
  getEPEmailHTML,
  getPRNppEmailHTML,
  getPONppEmailHTML,
  getPaymentNppEmailHTML,
  getApprovalEmailHTML
};