const PDFDocument = require("pdfkit");

function buildPaymentNppPdfBuffer(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 48, size: "A4" });
    const chunks = [];
    pdf.on("data", (c) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.fontSize(16).fillColor("#0f2a5e").text("Payment Advice (NPP)", { underline: true });
    pdf.moveDown(0.5).fontSize(10).fillColor("#333");
    pdf.text(`Status: ${d.status || ""}`);
    pdf.text(`Title: ${d.paymentTitle || "-"}`);
    pdf.text(`Vendor: ${d.vendorName || "-"}`);
    pdf.text(`Invoice No: ${d.invoiceNo || "-"}`);
    pdf.text(`Payment Type: ${d.paymentType || "-"}`);
    pdf.text(`Due Date: ${d.dueDate || "-"}`);
    pdf.moveDown().text(`Gross Total: INR ${Number(d.grossTotal || 0).toLocaleString("en-IN")}`);
    pdf.end();
  });
}

module.exports = { buildPaymentNppPdfBuffer };
