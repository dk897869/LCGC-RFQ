const { Resend } = require('resend');
const { generatePDFFromRequest } = require('./pdf.service');

const resend = new Resend(process.env.RESEND_API_KEY);

// Send email with PDF attachment
const sendEmailWithPDF = async (to, subject, html, text, pdfBuffer, ccList = []) => {
  try {
    const ccAddresses = Array.isArray(ccList) ? ccList.filter(cc => cc && cc.trim()) : [];
    
    console.log(`📧 Sending email to: ${to}`);
    if (ccAddresses.length > 0) {
      console.log(`📧 CC to: ${ccAddresses.join(', ')}`);
    }
    
    const attachments = pdfBuffer ? [
      {
        filename: 'EP_Request_Details.pdf',
        content: pdfBuffer.toString('base64'),
        encoding: 'base64'
      }
    ] : [];
    
    const emailOptions = {
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: html,
      text: text,
      attachments: attachments
    };
    
    if (ccAddresses.length > 0) {
      emailOptions.cc = ccAddresses;
    }
    
    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('❌ Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email sent via Resend:', data);
    return { success: true, data: data };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error: error.message };
  }
};

// Generate Email HTML from Request Data
const generateEmailHTML = (request, action, actor, nextApprover = null) => {
  const stakeholdersTable = request.stakeholders?.map(s => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.line || 'Sequential'}</td>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>${s.name}</strong></td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.remarks || '—'}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.designation}</td>
      <td style="padding: 10px; border: 1px solid #ddd;">
        <span style="background: ${s.status === 'Approved' ? '#d1fae5' : s.status === 'Rejected' ? '#fee2e2' : '#fef3c7'}; color: ${s.status === 'Approved' ? '#10b981' : s.status === 'Rejected' ? '#ef4444' : '#d97706'}; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
          ${s.status || 'Pending'}
        </span>
      </td>
      <td style="padding: 10px; border: 1px solid #ddd;">${s.dateTime ? new Date(s.dateTime).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
  
  const attachmentsTable = request.attachments?.map((att, idx) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${att.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${att.fileSize || 'N/A'}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${att.remark || '—'}</td>
    </tr>
  `).join('');
  
  let actionText = '';
  let actionColor = '#0f2a5e';
  
  switch(action) {
    case 'created':
      actionText = 'New EP Request Created';
      actionColor = '#0f2a5e';
      break;
    case 'approved':
      actionText = `Request Approved by ${actor?.name} (${actor?.designation})`;
      actionColor = '#10b981';
      break;
    case 'rejected':
      actionText = `Request Rejected by ${actor?.name} (${actor?.designation})`;
      actionColor = '#ef4444';
      break;
    case 'inprocess':
      actionText = `Request In Process - Approved by ${actor?.name}`;
      actionColor = '#d97706';
      break;
    case 'completed':
      actionText = 'Request Fully Approved - All Approvals Completed';
      actionColor = '#10b981';
      break;
    default:
      actionText = 'EP Request Update';
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LCGC RFQ - ${actionText}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
        .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 25px 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
        .content { padding: 30px; }
        .section-title { font-size: 18px; font-weight: 700; color: #0f2a5e; margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .section-title:first-of-type { margin-top: 0; }
        .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; background: #f8fafc; border-radius: 12px; overflow: hidden; }
        .info-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; }
        .info-table td:first-child { font-weight: 600; color: #0f2a5e; width: 140px; background: #f1f5f9; }
        .amount-highlight { font-size: 20px; font-weight: 800; color: #0f2a5e; background: #f1f5f9; padding: 10px 20px; border-radius: 8px; display: inline-block; margin: 10px 0; }
        .workflow-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
        .workflow-table th { background: #0f2a5e; color: white; padding: 10px 12px; text-align: left; }
        .workflow-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .attachments-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
        .attachments-table th { background: #f1f5f9; color: #0f2a5e; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .attachments-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        .button { display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #0f2a5e, #1e4a8a); color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; }
        .remarks-box { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #d97706; }
        .next-approver { background: #e0f2fe; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0284c7; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LCGC RFQ</h1>
          <p>Resolute Group</p>
        </div>
        <div class="content">
          <h2 style="color: ${actionColor}; margin: 0 0 20px;">${actionText}</h2>
          
          <div class="section-title">📋 Requestor Information</div>
          <table class="info-table">
            <tr><td>Name</td><td><strong>${request.requester}</strong></td><td>Request Date</td><td>${request.requestDate}</td></tr>
            <tr><td>Department</td><td>${request.department}</td><td>Contact No.</td><td>${request.contactNo || 'N/A'}</td></tr>
            <tr><td>Email ID</td><td>${request.email}</td><td>Organization</td><td>${request.organization || 'Radiant'}</td></tr>
          </table>
          
          <div class="section-title">📌 Activity Overview</div>
          <p><strong>Title of Activity:</strong> ${request.title}</p>
          <p>${request.description || 'No description provided'}</p>
          
          <div class="section-title">🎯 Purpose & Objective</div>
          <div class="amount-highlight">Amount/Cost: INR ${request.amount?.toLocaleString() || 0}/-</div>
          <p>${request.objective || 'No objective provided'}</p>
          <p><strong>Thank you</strong></p>
          
          <div class="section-title">👥 Approval Workflow</div>
          <table class="workflow-table">
            <thead><tr><th>Line</th><th>Stakeholder</th><th>Comments/Remarks</th><th>Designation</th><th>Status</th><th>Date/Time</th></tr></thead>
            <tbody>${stakeholdersTable}</tbody>
          </table>
          
          ${request.attachments && request.attachments.length > 0 ? `
          <div class="section-title">📎 Attachments</div>
          <table class="attachments-table">
            <thead><tr><th>S. No.</th><th>Attachment</th><th>File Size</th><th>Remark</th></tr></thead>
            <tbody>${attachmentsTable}</tbody>
          </table>
          ` : ''}
          
          ${actor && actor.remarks ? `
          <div class="remarks-box">
            <strong>📝 Remarks:</strong>
            <p style="margin: 8px 0 0;">${actor.remarks}</p>
          </div>
          ` : ''}
          
          ${nextApprover ? `
          <div class="next-approver">
            <strong>⏳ Next Approver:</strong> ${nextApprover.name} (${nextApprover.designation})<br>
            <strong>Email:</strong> ${nextApprover.email}
          </div>
          ` : ''}
          
          ${request.ccList && request.ccList.length > 0 ? `
          <div style="margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 12px;">
            <strong>CC Recipients:</strong> ${request.ccList.join('; ')}
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>This is an automated message from LCGC RFQ System. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} LCGC RFQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send approval update to CC recipients
const sendApprovalUpdateToCC = async (request, action, actor, nextApprover) => {
  if (!request.ccList || request.ccList.length === 0) return { success: true };
  
  const subject = `EP Request Update: ${request.title}`;
  const html = generateEmailHTML(request, action, actor, nextApprover);
  const text = `EP Request "${request.title}" has been updated. Please check the attached PDF for details.`;
  
  try {
    const pdfBuffer = await generatePDFFromRequest(request);
    const results = [];
    
    for (const ccEmail of request.ccList) {
      const result = await sendEmailWithPDF(ccEmail, subject, html, text, pdfBuffer, []);
      results.push(result);
      console.log(`📧 CC email sent to: ${ccEmail}`);
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('CC email error:', error);
    return { success: false, error: error.message };
  }
};

// Send New Request Email to Approver
const sendNewRequestEmail = async (request, approver) => {
  const subject = `📋 New EP Approval Request: ${request.title}`;
  const html = generateEmailHTML(request, 'created', null, approver);
  const text = `New EP Request: ${request.title}. Please review.`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(approver.email, subject, html, text, pdfBuffer, request.ccList);
};

// Send Approved Email to Requester and CC
const sendApprovedEmail = async (request, approver) => {
  const subject = `✅ EP Request Approved: ${request.title}`;
  const html = generateEmailHTML(request, 'approved', approver, null);
  const text = `Your EP request "${request.title}" has been APPROVED.`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(request.email, subject, html, text, pdfBuffer, request.ccList);
};

// Send Rejected Email
const sendRejectedEmail = async (request, approver) => {
  const subject = `❌ EP Request Rejected: ${request.title}`;
  const html = generateEmailHTML(request, 'rejected', approver, null);
  const text = `Your EP request "${request.title}" has been REJECTED.`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(request.email, subject, html, text, pdfBuffer, request.ccList);
};

// Send In-Process Email
const sendInProcessEmail = async (request, currentApprover) => {
  const subject = `🔄 EP Request In Process: ${request.title}`;
  const html = generateEmailHTML(request, 'inprocess', currentApprover, null);
  const text = `Your EP request "${request.title}" is IN PROCESS.`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(request.email, subject, html, text, pdfBuffer, request.ccList);
};

// Send Next Approver Notification
const sendNextApproverEmail = async (request, nextApprover, currentApprover) => {
  const subject = `🔍 Action Required: ${request.title}`;
  const html = generateEmailHTML(request, 'inprocess', currentApprover, nextApprover);
  const text = `Action Required: Please review EP request "${request.title}".`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(nextApprover.email, subject, html, text, pdfBuffer, request.ccList);
};

// Send Attachment Email
const sendAttachmentEmail = async (request, attachments) => {
  const subject = `📎 Attachments Added: ${request.title}`;
  const html = generateEmailHTML(request, 'created', null, null);
  const text = `New attachments added to EP request "${request.title}".`;
  const pdfBuffer = await generatePDFFromRequest(request);
  
  return await sendEmailWithPDF(request.email, subject, html, text, pdfBuffer, request.ccList);
};

module.exports = {
  sendNewRequestEmail,
  sendApprovedEmail,
  sendRejectedEmail,
  sendInProcessEmail,
  sendNextApproverEmail,
  sendAttachmentEmail,
  sendApprovalUpdateToCC
};