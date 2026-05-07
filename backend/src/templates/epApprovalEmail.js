function generateEPApprovalEmailHTML(epData) {
  const stakeholders = epData.stakeholders || [];
  const approverRows = stakeholders
    .map(
      (a, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${a.line || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${a.name || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${a.designation || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${a.email || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
        <span style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${
          a.status === 'Approved'
            ? '#d1fae5'
            : a.status === 'Rejected'
              ? '#fee2e2'
              : '#fef3c7'
        };color:${
          a.status === 'Approved'
            ? '#10b981'
            : a.status === 'Rejected'
              ? '#ef4444'
              : '#d97706'
        };">
          ${a.status || 'Pending'}
        </span>
      </td>
    </tr>
  `
    )
    .join('');

  const attachmentRows = (epData.attachments || [])
    .map(
      (att, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${att.name || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${att.fileSize || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${att.remark || ''}</td>
    </tr>
  `
    )
    .join('');

  const ccRows = (epData.ccList || [])
    .map((cc) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${cc}</td></tr>`)
    .join('');

  const pri = epData.priority || 'Medium';
  const priHigh = pri === 'High' || pri === 'Urgent' || pri === 'H';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>EP Approval Request - ${epData.title || ''}</title>
    </head>
    <body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f4f6f9;color:#1e293b;">
      <div style="max-width:900px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.1);">
        
        <div style="background:linear-gradient(135deg,#0f2a5e,#1e4a8a);padding:28px 32px;color:white;">
          <h1 style="margin:0 0 6px;font-size:22px;">EP Approval Request</h1>
          <p style="margin:0;opacity:0.8;font-size:13px;">Radiant Appliances &bull; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p style="margin:8px 0 0;font-size:14px;font-weight:600;">Overall status: ${epData.status || 'In-Process'}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:140px;padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Requester</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.requester || ''}</td>
            <td style="width:140px;padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Request Date</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.requestDate || ''}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Department</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.department || ''}</td>
            <td style="padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Contact No.</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.contactNo || ''}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Email ID</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.email || ''}</td>
            <td style="padding:10px 16px;background:#f8fafc;font-weight:700;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Organization</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">${epData.organization || ''}</td>
          </tr>
        </table>

        <div style="padding:20px 24px;background:#f0f4ff;border-bottom:1px solid #e2e8f0;">
          <h3 style="margin:0 0 12px;color:#0f2a5e;font-size:15px;border-left:4px solid #0f2a5e;padding-left:10px;">Activity Overview</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:140px;padding:6px 0;font-weight:700;font-size:13px;color:#475569;">Title:</td>
              <td style="padding:6px 0;font-size:13px;">${epData.title || ''}</td>
              <td style="width:140px;padding:6px 0;font-weight:700;font-size:13px;color:#475569;">Vendor:</td>
              <td style="padding:6px 0;font-size:13px;">${epData.vendor || ''}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-weight:700;font-size:13px;color:#475569;">Amount:</td>
              <td style="padding:6px 0;font-size:13px;font-weight:700;color:#1e40af;">INR ${Number(epData.amount || 0).toLocaleString('en-IN')}</td>
              <td style="padding:6px 0;font-weight:700;font-size:13px;color:#475569;">Priority:</td>
              <td style="padding:6px 0;font-size:13px;">
                <span style="padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${
                  priHigh ? '#fee2e2' : pri === 'Low' || pri === 'L' ? '#ecfdf5' : '#fef3c7'
                };color:${priHigh ? '#ef4444' : pri === 'Low' || pri === 'L' ? '#10b981' : '#d97706'};">
                  ${pri}
                </span>
              </td>
            </tr>
          </table>
          ${
            epData.description
              ? `<p style="margin:10px 0 4px;font-weight:700;color:#475569;font-size:13px;">Description / Purpose:</p><p style="margin:0;font-size:13px;">${epData.description}</p>`
              : ''
          }
          ${
            epData.objective
              ? `<p style="margin:10px 0 4px;font-weight:700;color:#475569;font-size:13px;">Objective:</p><p style="margin:0;font-size:13px;">${epData.objective}</p>`
              : ''
          }
        </div>

        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h3 style="margin:0 0 12px;color:#0f2a5e;font-size:15px;border-left:4px solid #0f2a5e;padding-left:10px;">Approval Chain</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">#</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Line</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Stakeholder</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Designation</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Email</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Status</th>
              </tr>
            </thead>
            <tbody>${approverRows}</tbody>
          </table>
        </div>

        ${
          (epData.attachments || []).length > 0
            ? `
        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h3 style="margin:0 0 12px;color:#0f2a5e;font-size:15px;border-left:4px solid #0f2a5e;padding-left:10px;">Attachments</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">S.No.</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Attachment</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">File Size</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Remark</th>
              </tr>
            </thead>
            <tbody>${attachmentRows}</tbody>
          </table>
        </div>`
            : ''
        }

        ${
          (epData.ccList || []).length > 0
            ? `
        <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <h3 style="margin:0 0 12px;color:#0f2a5e;font-size:15px;border-left:4px solid #0f2a5e;padding-left:10px;">CC Recipients</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Mail ID</th>
              </tr>
            </thead>
            <tbody>${ccRows}</tbody>
          </table>
        </div>`
            : ''
        }

        <div style="padding:14px 24px;background:#0f2a5e;color:rgba(255,255,255,0.7);font-size:11px;text-align:center;">
          This document was auto-generated by Radiant Appliances EP Approval System on ${new Date().toLocaleString('en-IN')}
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { generateEPApprovalEmailHTML };
