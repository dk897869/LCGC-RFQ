const PDFDocument = require('pdfkit');

function buildRfqPdfBuffer(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.fontSize(16).fillColor('#0f2a5e').text('Requisition RFQ (NPP)', { underline: true });
    pdf.moveDown(0.5);
    pdf.fontSize(10).fillColor('#333').text(`Status: ${d.status || 'In-Process'}`);
    pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Requester', { underline: true });
    pdf.fontSize(10).fillColor('#000');
    pdf.text(`Name: ${d.requesterName || ''}`);
    pdf.text(`Department: ${d.department || ''}`);
    pdf.text(`Email: ${d.emailId || ''}`);
    pdf.text(`Contact: ${d.contactNo || ''}`);
    pdf.text(`Organization: ${d.organization || ''}`);
    pdf.text(`Request date: ${d.requestDate ? new Date(d.requestDate).toLocaleDateString('en-IN') : ''}`);
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Activity', { underline: true });
    pdf.fontSize(10).fillColor('#000');
    pdf.text(`Title: ${d.titleOfActivity || ''}`);
    pdf.text(`Approval for: ${d.approvalFor || ''}`);
    pdf.text(`Priority: ${d.priority || ''}`);
    if (d.purposeAndObjective) pdf.text(`Purpose: ${d.purposeAndObjective}`);
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Line items', { underline: true });
    (d.items || []).forEach((it, i) => {
      pdf.fontSize(10).fillColor('#000');
      pdf.text(
        `${i + 1}. ${it.itemDescription || ''} | Qty ${it.quantity || ''} ${it.uom || ''} | Make: ${it.make || '-'}`
      );
    });
    pdf.moveDown();

    if ((d.ccTo || []).length) {
      pdf.fontSize(11).fillColor('#0f2a5e').text('CC', { underline: true });
      pdf.fontSize(10).fillColor('#000');
      d.ccTo.forEach((c) => pdf.text(`• ${c}`));
    }

    pdf.end();
  });
}

module.exports = { buildRfqPdfBuffer };
