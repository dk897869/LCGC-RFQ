function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrap(title, body) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="760" cellpadding="0" cellspacing="0" style="max-width:760px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0f2a5e;padding:20px 24px;color:#fff;">
          <div style="font-size:22px;font-weight:700;">Radiant Non-BOM Workflow</div>
          <div style="font-size:13px;opacity:.9;">Procurement approval notification</div>
        </td></tr>
        <tr><td style="padding:22px 24px;">${body}</td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;color:#6b7280;font-size:12px;">
          This is an automated email from RFQ system.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function baseInfo(doc, moduleName) {
  return `
    <h2 style="margin:0 0 12px;color:#0f2a5e;">${escapeHtml(moduleName)} Update</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border-radius:8px;">
      <tr><td><b>Title</b></td><td>${escapeHtml(doc.activityTitle || doc.poTitle || doc.paymentTitle || "")}</td></tr>
      <tr><td><b>Requester</b></td><td>${escapeHtml(doc.requester || "")}</td></tr>
      <tr><td><b>Department</b></td><td>${escapeHtml(doc.department || "")}</td></tr>
      <tr><td><b>Status</b></td><td>${escapeHtml(doc.status || "")}</td></tr>
      <tr><td><b>Control No</b></td><td>${escapeHtml(doc.controlNo || "-")}</td></tr>
      <tr><td><b>Total Value</b></td><td>INR ${Number(doc.totalValue || doc.poAmount || doc.grossTotal || 0).toLocaleString("en-IN")}</td></tr>
    </table>
  `;
}

function buildWorkflowRows(doc) {
  const rows = (doc.stakeholders || [])
    .map(
      (s) => `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.designation)}</td>
      <td>${escapeHtml(s.status)}</td>
      <td>${escapeHtml(s.remarks || "-")}</td>
      <td>${s.dateTime ? new Date(s.dateTime).toLocaleString("en-IN") : "-"}</td>
    </tr>`
    )
    .join("");
  if (!rows) return "";
  return `<h3 style="margin:16px 0 8px;color:#0f2a5e;">Approval Workflow</h3>
  <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
    <thead><tr style="background:#e5e7eb;"><th align="left">Name</th><th align="left">Designation</th><th align="left">Status</th><th align="left">Remarks</th><th align="left">Date/Time</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildNppEmail({ moduleName, actionText, doc, actorName, remarks }) {
  const body = `
    <p style="margin:0 0 10px;">Action: <b>${escapeHtml(actionText)}</b>${actorName ? ` by <b>${escapeHtml(actorName)}</b>` : ""}</p>
    ${baseInfo(doc, moduleName)}
    ${remarks ? `<p style="margin-top:12px;padding:10px;background:#fff7ed;border-left:4px solid #f59e0b;"><b>Remarks:</b> ${escapeHtml(remarks)}</p>` : ""}
    ${buildWorkflowRows(doc)}
  `;
  return wrap(`${moduleName} ${actionText}`, body);
}

module.exports = { buildNppEmail };
