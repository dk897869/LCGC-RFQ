const PDFDocument = require('pdfkit');

function buildEpPdfBuffer(epData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#0f2a5e').text('EP Approval Request', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333').text(`Status: ${epData.status || 'In-Process'}`);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#0f2a5e').text('Requester details', { underline: true });
    doc.fontSize(10).fillColor('#000');
    doc.text(`Requester: ${epData.requester || ''}`);
    doc.text(`Department: ${epData.department || ''}`);
    doc.text(`Email: ${epData.email || ''}`);
    doc.text(`Contact: ${epData.contactNo || ''}`);
    doc.text(`Organization: ${epData.organization || ''}`);
    doc.text(`Request date: ${epData.requestDate || ''}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#0f2a5e').text('Activity', { underline: true });
    doc.fontSize(10).fillColor('#000');
    doc.text(`Title: ${epData.title || ''}`);
    doc.text(`Vendor: ${epData.vendor || ''}`);
    doc.text(`Amount (INR): ${Number(epData.amount || 0).toLocaleString('en-IN')}`);
    doc.text(`Priority: ${epData.priority || ''}`);
    if (epData.description) doc.text(`Description: ${epData.description}`);
    if (epData.objective) doc.text(`Objective: ${epData.objective}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#0f2a5e').text('Approval chain', { underline: true });
    doc.moveDown(0.3);
    (epData.stakeholders || []).forEach((s, i) => {
      doc.fontSize(10).fillColor('#000');
      doc.text(
        `${i + 1}. [${s.line || '-'}] ${s.name || ''} (${s.designation || ''}) — ${s.status || 'Pending'}`
      );
      if (s.email) doc.text(`   Email: ${s.email}`, { indent: 12 });
      if (s.remarks) doc.text(`   Remarks: ${s.remarks}`, { indent: 12 });
    });
    doc.moveDown();

    if ((epData.attachments || []).length) {
      doc.fontSize(12).fillColor('#0f2a5e').text('Attachments', { underline: true });
      epData.attachments.forEach((a, i) => {
        doc.fontSize(10).fillColor('#000');
        doc.text(`${i + 1}. ${a.name || 'File'} — ${a.fileSize || ''} — ${a.remark || ''}`);
      });
      doc.moveDown();
    }

    if ((epData.ccList || []).length) {
      doc.fontSize(12).fillColor('#0f2a5e').text('CC', { underline: true });
      doc.fontSize(10).fillColor('#000');
      epData.ccList.forEach((c) => doc.text(`• ${c}`));
    }

    doc.end();
  });
}

module.exports = { buildEpPdfBuffer };
