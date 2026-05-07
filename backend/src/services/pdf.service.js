const PDFDocument = require('pdfkit');

function escapePdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate beautiful PDF for any request type (RFQ, EP, PR, PO, Payment)
 */
const generateBeautifulPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4',
        info: {
          Title: 'LCGC Request Document',
          Author: 'LCGC System',
          Subject: 'Procurement Request',
          Producer: 'LCGC',
          Creator: 'LCGC RFQ System'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Determine request type
      const isRFQ = data.items !== undefined && !data.source && !data.orderNo && !data.invoices;
      const isEP = data.stakeholders !== undefined && !data.source && !data.items;
      const isPR = data.source === 'PR-REQUEST-NPP' || (data.items && data.items[0] && data.items[0].costCenter);
      const isPO = data.source === 'PO-NPP' || (data.orderNo !== undefined);
      const isPayment = data.source === 'PAYMENT-ADVISE-NPP' || (data.invoices !== undefined);
      
      const title = isRFQ ? 'REQUEST FOR QUOTATION (RFQ)' : 
                    isPO ? 'PURCHASE ORDER' : 
                    isPR ? 'PURCHASE REQUEST (PR)' :
                    isPayment ? 'PAYMENT ADVICE' :
                    'EP APPROVAL REQUEST';
      
      const serialNo = data.uniqueSerialNo || data._id || 'N/A';
      const status = data.status || 'Pending';
      const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
      
      // ====================== HEADER ======================
      // Company Header
      doc.rect(0, 0, doc.page.width, 120).fill('#0f2a5e');
      
      // Logo/Company Name
      doc.fillColor('#ffffff')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('LCGC RFQ SYSTEM', 50, 45);
      
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(title, 50, 80);
      
      // Document Info Box
      doc.rect(doc.page.width - 160, 30, 130, 70)
        .fill('#1e3a5f')
        .stroke('#2d4a7a');
      
      doc.fillColor('#ffffff')
        .fontSize(9)
        .font('Helvetica')
        .text('Serial No:', doc.page.width - 150, 40);
      doc.fillColor('#fcd34d')
        .font('Helvetica-Bold')
        .text(escapePdfText(serialNo), doc.page.width - 150, 55);
      
      doc.fillColor('#ffffff')
        .font('Helvetica')
        .text('Status:', doc.page.width - 150, 75);
      
      // Status Badge
      doc.rect(doc.page.width - 150, 88, 70, 18).fill(statusColor);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(status, doc.page.width - 145, 92);
      
      doc.fillColor('#94a3b8')
        .font('Helvetica')
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleString()}`, doc.page.width - 150, 115, { align: 'right' });
      
      // ====================== REQUESTER INFORMATION ======================
      doc.moveDown(3);
      
      // Section Title
      doc.fillColor('#1e3a8a')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('📋 REQUESTER INFORMATION', 50, doc.y);
      
      doc.moveDown(0.5);
      
      // Requester Box
      const reqBoxY = doc.y;
      doc.roundedRect(50, reqBoxY - 5, doc.page.width - 100, 95, 8)
        .fill('#f8fafc')
        .stroke('#e2e8f0');
      
      // Requester Fields
      doc.fillColor('#475569')
        .fontSize(9)
        .font('Helvetica');
      
      const fields = [
        { label: 'Name:', value: data.requesterName || data.requester || data.purchaser || '—', x: 70, y: reqBoxY + 5 },
        { label: 'Department:', value: data.department || '—', x: 320, y: reqBoxY + 5 },
        { label: 'Email:', value: data.emailId || data.email || '—', x: 70, y: reqBoxY + 30 },
        { label: 'Contact No.:', value: data.contactNo || '—', x: 320, y: reqBoxY + 30 },
        { label: 'Organization:', value: data.organization || 'Radiant Appliances', x: 70, y: reqBoxY + 55 },
        { label: 'Request Date:', value: data.requestDate || new Date().toLocaleDateString(), x: 320, y: reqBoxY + 55 }
      ];
      
      fields.forEach(field => {
        doc.fillColor('#475569').text(field.label, field.x, field.y);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(field.value, field.x + 65, field.y);
      });
      
      doc.moveDown(6);
      
      // ====================== ACTIVITY DETAILS ======================
      doc.fillColor('#1e3a8a')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('🎯 ACTIVITY DETAILS', 50, doc.y);
      
      doc.moveDown(0.5);
      
      const actBoxY = doc.y;
      doc.roundedRect(50, actBoxY - 5, doc.page.width - 100, 85, 8)
        .fill('#ffffff')
        .stroke('#e2e8f0');
      
      // Activity Fields
      const vendorName = data.vendorName || data.vendor || '—';
      const priorityValue = data.priority === 'H' ? 'High' : data.priority === 'M' ? 'Medium' : data.priority === 'L' ? 'Low' : (data.priority || 'Medium');
      const priorityColor = priorityValue === 'High' ? '#dc2626' : priorityValue === 'Medium' ? '#d97706' : '#16a34a';
      
      doc.fillColor('#475569')
        .font('Helvetica')
        .text('Title:', 70, actBoxY + 5);
      doc.fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text(escapePdfText(data.titleOfActivity || data.title || '—').substring(0, 60), 130, actBoxY + 5);
      
      doc.fillColor('#475569')
        .text('Vendor/Supplier:', 70, actBoxY + 30);
      doc.fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text(escapePdfText(vendorName).substring(0, 40), 190, actBoxY + 30);
      
      // Priority Badge
      doc.roundedRect(450, actBoxY + 28, 80, 20, 10).fill(priorityColor);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${priorityValue} Priority`, 470, actBoxY + 33, { align: 'center' });
      
      doc.fillColor('#475569')
        .text('Description:', 70, actBoxY + 55);
      doc.fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(9)
        .text(escapePdfText(data.purposeAndObjective || data.description || 'No description provided').substring(0, 200), 155, actBoxY + 55, { width: 350 });
      
      doc.moveDown(5);
      
      // ====================== AMOUNT SECTION ======================
      const amount = data.amount || data.expenseAmount || 0;
      const amountY = doc.y;
      doc.roundedRect(50, amountY, doc.page.width - 100, 55, 8)
        .fill('#e0e7ff')
        .stroke('#c7d2fe');
      
      doc.fillColor('#64748b')
        .fontSize(10)
        .font('Helvetica')
        .text('💰 TOTAL AMOUNT', 70, amountY + 12);
      doc.fillColor('#1e40af')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(`₹ ${Number(amount).toLocaleString('en-IN')}`, 70, amountY + 28);
      
      doc.moveDown(4);
      
      // ====================== ITEMS TABLE (RFQ) ======================
      if (isRFQ && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('📦 REQUEST ITEMS', 50, doc.y);
        
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const colWidths = [40, 200, 60, 60, 100];
        
        // Table Header
        doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(9)
          .font('Helvetica-Bold');
        
        doc.text('#', 55, tableTop);
        doc.text('Item Description', 80, tableTop);
        doc.text('UOM', 280, tableTop);
        doc.text('Qty', 340, tableTop);
        doc.text('Make', 390, tableTop);
        
        let rowY = tableTop + 20;
        let even = false;
        
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }
          
          if (even) {
            doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(8)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.itemDescription || item.description || '—').substring(0, 35), 80, rowY);
          doc.text(item.uom || 'Pcs', 280, rowY);
          doc.text((item.quantity || item.qty || 0).toString(), 340, rowY);
          doc.text(escapePdfText(item.make || '—').substring(0, 20), 390, rowY);
          
          rowY += 22;
          even = !even;
        }
        
        doc.moveDown(2);
      }
      
      // ====================== ITEMS TABLE (PO) ======================
      if (isPO && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('📦 ORDER ITEMS', 50, doc.y);
        
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const colWidths = [40, 180, 80, 60, 80, 100];
        
        // Table Header
        doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(8)
          .font('Helvetica-Bold');
        
        doc.text('#', 55, tableTop);
        doc.text('Description', 80, tableTop);
        doc.text('Part Code', 230, tableTop);
        doc.text('Qty', 310, tableTop);
        doc.text('Unit Price', 360, tableTop);
        doc.text('Total', 440, tableTop);
        
        let rowY = tableTop + 20;
        let even = false;
        let poTotal = 0;
        
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          const base = (item.qty || 0) * (item.unitPrice || 0);
          const gst = base * ((item.cgst || 0) + (item.sgst || 0)) / 100;
          const total = base + gst;
          poTotal += total;
          
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }
          
          if (even) {
            doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(8)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.partDescription || '—').substring(0, 30), 80, rowY);
          doc.text(escapePdfText(item.partCode || '—').substring(0, 15), 230, rowY);
          doc.text((item.qty || 0).toString(), 310, rowY);
          doc.text(`₹${(item.unitPrice || 0).toLocaleString('en-IN')}`, 360, rowY);
          doc.text(`₹${total.toLocaleString('en-IN')}`, 440, rowY);
          
          rowY += 22;
          even = !even;
        }
        
        // Grand Total Row
        doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('GRAND TOTAL:', 390, rowY);
        doc.text(`₹${poTotal.toLocaleString('en-IN')}`, 440, rowY);
        
        doc.moveDown(2);
      }
      
      // ====================== ITEMS TABLE (PR) ======================
      if (isPR && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('📦 PR ITEMS', 50, doc.y);
        
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        
        doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(8)
          .font('Helvetica-Bold');
        
        doc.text('#', 55, tableTop);
        doc.text('Description', 80, tableTop);
        doc.text('Part Code', 230, tableTop);
        doc.text('Qty', 310, tableTop);
        doc.text('Unit Price', 360, tableTop);
        doc.text('Total', 440, tableTop);
        
        let rowY = tableTop + 20;
        let even = false;
        let prTotal = 0;
        
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          const total = (item.qty || 0) * (item.unitPrice || 0);
          prTotal += total;
          
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }
          
          if (even) {
            doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(8)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.partDescription || '—').substring(0, 30), 80, rowY);
          doc.text(escapePdfText(item.partCode || '—').substring(0, 15), 230, rowY);
          doc.text((item.qty || 0).toString(), 310, rowY);
          doc.text(`₹${(item.unitPrice || 0).toLocaleString('en-IN')}`, 360, rowY);
          doc.text(`₹${total.toLocaleString('en-IN')}`, 440, rowY);
          
          rowY += 22;
          even = !even;
        }
        
        doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('TOTAL VALUE:', 390, rowY);
        doc.text(`₹${prTotal.toLocaleString('en-IN')}`, 440, rowY);
        
        doc.moveDown(2);
      }
      
      // ====================== INVOICES TABLE (PAYMENT) ======================
      if (isPayment && data.invoices && data.invoices.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('📄 INVOICES', 50, doc.y);
        
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        
        doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(9)
          .font('Helvetica-Bold');
        
        doc.text('#', 55, tableTop);
        doc.text('Invoice No.', 80, tableTop);
        doc.text('Date', 250, tableTop);
        doc.text('Value', 370, tableTop);
        
        let rowY = tableTop + 20;
        let even = false;
        let invoiceTotal = 0;
        
        for (let idx = 0; idx < data.invoices.length; idx++) {
          const inv = data.invoices[idx];
          invoiceTotal += (inv.invoiceValue || 0);
          
          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }
          
          if (even) {
            doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(9)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(inv.invoiceNo || '—'), 80, rowY);
          doc.text(inv.invoiceDate || '—', 250, rowY);
          doc.text(`₹${(inv.invoiceValue || 0).toLocaleString('en-IN')}`, 370, rowY);
          
          rowY += 22;
          even = !even;
        }
        
        doc.rect(50, rowY - 3, doc.page.width - 100, 22).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('TOTAL:', 340, rowY);
        doc.text(`₹${invoiceTotal.toLocaleString('en-IN')}`, 370, rowY);
        
        doc.moveDown(2);
      }
      
      // ====================== CC RECIPIENTS ======================
      const ccList = data.ccTo || data.ccList || [];
      if (ccList.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('📧 CC RECIPIENTS', 50, doc.y);
        
        doc.moveDown(0.3);
        
        doc.roundedRect(50, doc.y - 3, doc.page.width - 100, ccList.length * 20 + 10, 6)
          .fill('#f8fafc')
          .stroke('#e2e8f0');
        
        let ccY = doc.y + 5;
        ccList.forEach(cc => {
          doc.fillColor('#1e40af')
            .fontSize(9)
            .font('Helvetica')
            .text(`✉️  ${escapePdfText(cc)}`, 65, ccY);
          ccY += 20;
        });
        
        doc.moveDown(1.5);
      }
      
      // ====================== FOOTER ======================
      const footerY = doc.page.height - 50;
      doc.rect(0, footerY, doc.page.width, 50).fill('#f8fafc');
      
      doc.fillColor('#94a3b8')
        .fontSize(8)
        .font('Helvetica')
        .text('This is an automatically generated document from LCGC RFQ System.', 50, footerY + 18, { align: 'center', width: doc.page.width - 100 });
      
      doc.text(`© ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'Resolute Group'}. All rights reserved.`, 50, footerY + 32, { align: 'center', width: doc.page.width - 100 });
      
      doc.end();
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      reject(error);
    }
  });
};

module.exports = { generateBeautifulPDF };