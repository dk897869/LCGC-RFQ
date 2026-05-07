// Email template service for EP Approval workflow

// Main email template wrapper
const getEmailWrapper = (content, title, statusColor = '#0f2a5e') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LCGC RFQ - ${title}</title>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f6f9;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%);
          padding: 25px 30px;
          text-align: center;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
        }
        .header p {
          color: rgba(255,255,255,0.9);
          margin: 8px 0 0;
          font-size: 14px;
        }
        .content {
          padding: 30px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f2a5e;
          margin: 25px 0 15px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        .section-title:first-of-type {
          margin-top: 0;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          background: #f8fafc;
          border-radius: 12px;
          overflow: hidden;
        }
        .info-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-table tr:last-child td {
          border-bottom: none;
        }
        .info-table td:first-child {
          font-weight: 600;
          color: #0f2a5e;
          width: 140px;
          background: #f1f5f9;
        }
        .amount-highlight {
          font-size: 20px;
          font-weight: 800;
          color: #0f2a5e;
          background: #f1f5f9;
          padding: 10px 20px;
          border-radius: 8px;
          display: inline-block;
          margin: 10px 0;
        }
        .workflow-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 13px;
        }
        .workflow-table th {
          background: #0f2a5e;
          color: white;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
        }
        .workflow-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .workflow-table tr:hover td {
          background: #f8fafc;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-approved {
          background: #d1fae5;
          color: #10b981;
        }
        .status-rejected {
          background: #fee2e2;
          color: #ef4444;
        }
        .status-inprocess {
          background: #fef3c7;
          color: #d97706;
        }
        .status-pending {
          background: #e0f2fe;
          color: #0284c7;
        }
        .attachments-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 13px;
        }
        .attachments-table th {
          background: #f1f5f9;
          color: #0f2a5e;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid #e2e8f0;
        }
        .attachments-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .remarks-box {
          background: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          border-left: 4px solid #d97706;
        }
        .footer {
          text-align: center;
          padding: 20px;
          background: #f8fafc;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .button {
          display: inline-block;
          padding: 10px 24px;
          background: linear-gradient(135deg, #0f2a5e, #1e4a8a);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 15px 0;
          font-weight: 600;
          font-size: 14px;
        }
        .thankyou {
          margin-top: 25px;
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LCGC RFQ</h1>
          <p>Resolute Group</p>
        </div>
        <div class="content">
          ${content}
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

// Template for CC Email (All updates sent to CC recipients) - UPDATED with full details
const getCCEmailTemplate = (request, action, actor, remarks) => {
  let actionColor = '#0f2a5e';
  let actionText = '';
  let actionIcon = '📋';
  
  switch(action) {
    case 'approved':
      actionColor = '#10b981';
      actionText = 'APPROVED';
      actionIcon = '✅';
      break;
    case 'rejected':
      actionColor = '#ef4444';
      actionText = 'REJECTED';
      actionIcon = '❌';
      break;
    case 'inprocess':
      actionColor = '#d97706';
      actionText = 'IN PROCESS';
      actionIcon = '🔄';
      break;
    case 'created':
      actionColor = '#0f2a5e';
      actionText = 'CREATED';
      actionIcon = '📋';
      break;
  }
  
  // Build stakeholders table rows
  const stakeholdersRows = request.stakeholders?.map(s => `
    <tr>
      <td>${s.line || 'Sequential'}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.remarks || '—'}</td>
      <td>${s.designation}</td>
      <td><span class="status-badge status-${s.status?.toLowerCase()}">${s.status || 'Pending'}</span></td>
      <td>${s.dateTime ? new Date(s.dateTime).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
  
  // Build attachments rows
  const attachmentsRows = request.attachments?.map((att, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${att.name}</td>
      <td>${att.fileSize || 'N/A'}</td>
      <td>${att.remark || '—'}</td>
    </tr>
  `).join('');
  
  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 48px;">${actionIcon}</span>
      <h2 style="color: ${actionColor}; margin: 10px 0 0;">EP Request ${actionText}</h2>
      <p style="color: #64748b; margin-top: 5px;">This is a system generated notification for CC recipients</p>
    </div>
    
    <p>Dear Team,</p>
    <p>This is to inform you that an EP request has been <strong style="color: ${actionColor};">${actionText}</strong>.</p>
    
    <!-- Requestor Information Section -->
    <div class="section-title">📋 Requestor Information</div>
    <table class="info-table">
      <tr>
        <td>Name</td>
        <td><strong>${request.requester || 'N/A'}</strong></td>
        <td>Request Date</td>
        <td>${request.requestDate || new Date().toLocaleDateString()}</td>
      </tr>
      <tr>
        <td>Department</td>
        <td>${request.department || 'N/A'}</td>
        <td>Contact No.</td>
        <td>${request.contactNo || 'N/A'}</td>
      </tr>
      <tr>
        <td>Email ID</td>
        <td>${request.email || 'N/A'}</td>
        <td>Organization</td>
        <td>${request.organization || 'Radiant'}</td>
      </tr>
    </table>
    
    <!-- Activity Overview Section -->
    <div class="section-title">📌 Activity Overview</div>
    <p><strong>Title of Activity:</strong></p>
    <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${request.title || 'N/A'}</p>
    
    <p><strong>Dear Sir,</strong></p>
    <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${request.description || 'No description provided'}</p>
    
    <!-- Purpose & Objective Section -->
    <div class="section-title">🎯 Purpose & Objective</div>
    <div class="amount-highlight">Amount/Cost: INR ${request.amount?.toLocaleString() || 0}/-</div>
    <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${request.objective || 'No objective provided'}</p>
    
    <p><strong>Thank you</strong></p>
    
    <!-- Approval Workflow Section -->
    <div class="section-title">👥 Approval Workflow</div>
    <table class="workflow-table">
      <thead>
        <tr>
          <th>Line</th>
          <th>Stakeholder</th>
          <th>Comments/Remarks</th>
          <th>Designation</th>
          <th>Status</th>
          <th>Date/Time</th>
        </tr>
      </thead>
      <tbody>
        ${stakeholdersRows || '<tr><td colspan="6">No stakeholders defined</td></tr>'}
      </tbody>
    </table>
    
    ${request.attachments && request.attachments.length > 0 ? `
    <!-- Attachments Section -->
    <div class="section-title">📎 Attachments</div>
    <table class="attachments-table">
      <thead>
        <tr>
          <th>S. No.</th>
          <th>Attachment</th>
          <th>File Size</th>
          <th>Remark</th>
        </tr>
      </thead>
      <tbody>
        ${attachmentsRows}
      </tbody>
    </table>
    ` : ''}
    
    ${remarks ? `
    <div class="remarks-box">
      <strong>📝 Action Remarks:</strong>
      <p style="margin: 8px 0 0;">${remarks}</p>
    </div>
    ` : ''}
    
    ${actor ? `
    <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 15px 0;">
      <strong>Action By:</strong> ${actor.name} (${actor.designation})<br>
      <strong>Action Time:</strong> ${new Date().toLocaleString()}
    </div>
    ` : ''}
    
    <div class="thankyou">
      <p>You can track the full details and history of this request in the EP Approval dashboard.</p>
      <p>If you have any questions, please contact the requester or the respective approver.</p>
    </div>
  `;
  
  return getEmailWrapper(content, `EP Request ${actionText} Update - CC Notification`, actionColor);
};

// Template for New EP Request - Sent to Approver (also with full details)
const getNewRequestTemplate = (request, approver, approvalLink) => {
  const stakeholdersRows = request.stakeholders?.map(s => `
    <tr>
      <td>${s.line || 'Sequential'}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.remarks || '—'}</td>
      <td>${s.designation}</td>
      <td><span class="status-badge status-${s.status?.toLowerCase()}">${s.status || 'Pending'}</span></td>
      <td>${s.dateTime ? new Date(s.dateTime).toLocaleString() : '—'}</td>
    </tr>
  `).join('');
  
  const attachmentsRows = request.attachments?.map((att, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${att.name}</td>
      <td>${att.fileSize || 'N/A'}</td>
      <td>${att.remark || '—'}</td>
    </tr>
  `).join('');
  
  const content = `
    <h2 style="color: #0f2a5e; margin-top: 0;">📋 New EP Approval Request</h2>
    <p>Dear <strong>${approver.name}</strong>,</p>
    <p>A new EP approval request has been created and requires your review and approval.</p>
    
    <div class="section-title">📋 Requestor Information</div>
    <table class="info-table">
      <tr>
        <td>Name</td>
        <td><strong>${request.requester}</strong></td>
        <td>Request Date</td>
        <td>${request.requestDate || new Date().toLocaleDateString()}</td>
      </tr>
      <tr>
        <td>Department</td>
        <td>${request.department}</td>
        <td>Contact No.</td>
        <td>${request.contactNo || 'N/A'}</td>
      </tr>
      <tr>
        <td>Email ID</td>
        <td>${request.email}</td>
        <td>Organization</td>
        <td>${request.organization || 'Radiant'}</td>
      </tr>
    </table>
    
    <div class="section-title">📌 Activity Overview</div>
    <p><strong>Title of Activity:</strong></p>
    <p style="background: #f8fafc; padding: 12px; border-radius: 8px;">${request.title}</p>
    <p>${request.description || 'No description provided'}</p>
    
    <div class="section-title">🎯 Purpose & Objective</div>
    <div class="amount-highlight">Amount/Cost: INR ${request.amount?.toLocaleString() || 0}/-</div>
    <p>${request.objective || 'No objective provided'}</p>
    
    <div class="section-title">👥 Approval Workflow</div>
    <table class="workflow-table">
      <thead>
        <tr><th>Line</th><th>Stakeholder</th><th>Comments/Remarks</th><th>Designation</th><th>Status</th><th>Date/Time</th></tr>
      </thead>
      <tbody>
        ${stakeholdersRows}
      </tbody>
    </table>
    
    ${request.attachments && request.attachments.length > 0 ? `
    <div class="section-title">📎 Attachments</div>
    <table class="attachments-table">
      <thead><tr><th>S. No.</th><th>Attachment</th><th>File Size</th><th>Remark</th></tr></thead>
      <tbody>${attachmentsRows}</tbody>
    </table>
    ` : ''}
    
    <div style="text-align: center;">
      <a href="${approvalLink}" class="button">🔍 Review & Take Action</a>
    </div>
  `;
  return getEmailWrapper(content, 'New EP Approval Request');
};

// Export all templates
module.exports = {
  getNewRequestTemplate,
  getCCEmailTemplate,
  getApprovedTemplate: (request, approver) => getCCEmailTemplate(request, 'approved', approver, approver.remarks),
  getRejectedTemplate: (request, approver) => getCCEmailTemplate(request, 'rejected', approver, approver.remarks),
  getInProcessTemplate: (request, currentApprover) => getCCEmailTemplate(request, 'inprocess', currentApprover, currentApprover.remarks),
  getNextApproverTemplate: (request, nextApprover, currentApprover, approvalLink) => {
    const content = `
      <h2 style="color: #0f2a5e;">📋 Request Ready for Your Approval</h2>
      <p>Dear <strong>${nextApprover.name}</strong>,</p>
      <p><strong>${currentApprover.name}</strong> (${currentApprover.designation}) has approved the request. It is now your turn to review and take action.</p>
      
      <div class="section-title">📋 Requestor Information</div>
      <table class="info-table">
        <tr><td>Name</td><td><strong>${request.requester}</strong></td><td>Request Date</td><td>${request.requestDate}</td></tr>
        <tr><td>Department</td><td>${request.department}</td><td>Contact No.</td><td>${request.contactNo || 'N/A'}</td></tr>
        <tr><td>Email ID</td><td>${request.email}</td><td>Organization</td><td>${request.organization || 'Radiant'}</td></tr>
      </table>
      
      <div class="section-title">📌 Activity Overview</div>
      <p><strong>Title:</strong> ${request.title}</p>
      <p>${request.description || 'No description'}</p>
      
      <div class="section-title">🎯 Purpose & Objective</div>
      <div class="amount-highlight">Amount: INR ${request.amount?.toLocaleString() || 0}/-</div>
      
      <div style="text-align: center;">
        <a href="${approvalLink}" class="button">🔍 Review Request</a>
      </div>
    `;
    return getEmailWrapper(content, 'Action Required - EP Approval');
  },
  getAttachmentTemplate: (request, attachments) => {
    const attachmentsRows = attachments.map((att, idx) => `
      <tr><td>${idx + 1}</td><td>${att.name}</td><td>${att.fileSize || 'N/A'}</td><td>${att.remark || '—'}</td></tr>
    `).join('');
    
    const content = `
      <h2 style="color: #0f2a5e;">📎 Attachments Added to EP Request</h2>
      <p>Dear <strong>${request.requester}</strong>,</p>
      <p>New attachments have been added to your EP request.</p>
      
      <table class="attachments-table">
        <thead><tr><th>S. No.</th><th>Attachment</th><th>File Size</th><th>Remark</th></tr></thead>
        <tbody>${attachmentsRows}</tbody>
      </table>
    `;
    return getEmailWrapper(content, 'Attachments Added');
  }
};