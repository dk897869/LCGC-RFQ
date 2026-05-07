const PDFDocument = require('pdfkit');

function buildPrNppPdfBuffer(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.fontSize(16).fillColor('#0f2a5e').text('PR Approval (NPP)', { underline: true });
    pdf.moveDown(0.5);
    pdf.fontSize(10).fillColor('#333').text(`Status: ${d.status || ''}`);
    pdf.text(`Control No: ${d.controlNo || '-'}`);
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Requester', { underline: true });
    pdf.fontSize(10).fillColor('#000');
    pdf.text(`${d.requester || ''} | ${d.department || ''}`);
    pdf.text(`Email: ${d.email || ''} | Contact: ${d.contactNo || ''}`);
    pdf.text(`Date: ${d.requestDate || ''}`);
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Activity', { underline: true });
    pdf.fontSize(10).text(d.activityTitle || '');
    pdf.moveDown();

    pdf.fontSize(11).fillColor('#0f2a5e').text('Line items', { underline: true });
    (d.lineItems || []).forEach((row, i) => {
      pdf.fontSize(9).text(
        `${i + 1}. ${row.itemDescription || ''} | ${row.qty || 0} ${row.uom || ''} @ ${row.unitPrice || 0} = ${row.value || 0}`
      );
    });
    pdf.moveDown(0.5);
    pdf.fontSize(10).text(`Total value: ${Number(d.totalValue || 0).toLocaleString('en-IN')}`);

    pdf.end();
  });
}

module.exports = { buildPrNppPdfBuffer };
