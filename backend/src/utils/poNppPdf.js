const PDFDocument = require("pdfkit");

function buildPoNppPdfBuffer(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48, size: "A4" });
    const chunks = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.fontSize(16).fillColor("#0f2a5e").text("PO Approval (NPP)", { underline: true });
    pdf.moveDown(0.5).fontSize(10).fillColor("#333");
    pdf.text(`Status: ${d.status || ""}`);
    pdf.text(`PO No: ${d.poNo || "-"}`);
    pdf.text(`Vendor: ${d.vendorName || "-"}`);
    pdf.text(`Title: ${d.poTitle || "-"}`);
    pdf.moveDown();

    (d.items || []).forEach((item, i) => {
      pdf.fontSize(9).fillColor("#111").text(
        `${i + 1}. ${item.description || ""} | ${item.qty || 0} ${item.uom || ""} @ ${item.unitPrice || 0} = ${item.value || 0}`
      );
    });
    pdf.moveDown(0.5).fontSize(10).text(`Total: ${Number(d.poAmount || 0).toLocaleString("en-IN")}`);
    pdf.end();
  });
}

module.exports = { buildPoNppPdfBuffer };
