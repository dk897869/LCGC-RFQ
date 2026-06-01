const PDFDocument = require('pdfkit');

function escapePdfText(str) {
  if (!str) return '';
  // Remove all special characters, keep only alphanumeric and spaces
  return String(str)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')  // Replace special chars with space
    .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
    .trim();
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
        layout: 'portrait',
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
      
      const title = isRFQ ? 'REQUEST FOR QUOTATION RFQ' : 
                    isPO ? 'PURCHASE ORDER' : 
                    isPR ? 'PURCHASE REQUEST PR' :
                    isPayment ? 'PAYMENT ADVICE' :
                    'EP APPROVAL REQUEST';
      
      const serialNo = escapePdfText(data.uniqueSerialNo || data._id || 'N A');
      const status = escapePdfText(data.status || 'Pending');
      const statusColor = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
      
      // ====================== HEADER ======================
      // Company Header
      doc.rect(0, 0, doc.page.width, 100).fill('#0f2a5e');
      
      // Logo/Company Name
      doc.fillColor('#ffffff')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('LCGC RFQ SYSTEM', 50, 35);
      
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(title, 50, 65);
      
      // Document Info Box
      doc.rect(doc.page.width - 150, 25, 120, 60)
        .fill('#1e3a5f')
        .stroke('#2d4a7a');
      
      doc.fillColor('#ffffff')
        .fontSize(8)
        .font('Helvetica')
        .text('Serial No', doc.page.width - 140, 35);
      doc.fillColor('#fcd34d')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(escapePdfText(serialNo), doc.page.width - 140, 48);
      
      doc.fillColor('#ffffff')
        .font('Helvetica')
        .fontSize(8)
        .text('Status', doc.page.width - 140, 65);
      
      // Status Badge
      doc.rect(doc.page.width - 140, 75, 60, 12).fill(statusColor);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(status, doc.page.width - 137, 77);
      
      // ====================== REQUESTER INFORMATION ======================
      let currentY = 130;
      
      // Section Title
      doc.fillColor('#1e3a8a')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('REQUESTER INFORMATION', 50, currentY);
      
      currentY = doc.y + 10;
      
      // Requester Box
      doc.roundedRect(50, currentY - 5, doc.page.width - 100, 75, 6)
        .fill('#f8fafc')
        .stroke('#e2e8f0');
      
      // Requester Fields
      doc.fillColor('#475569')
        .fontSize(8)
        .font('Helvetica');
      
      const fields = [
        { label: 'Name', value: data.requesterName || data.requester || data.purchaser || '', x: 70, y: currentY + 5 },
        { label: 'Department', value: data.department || '', x: 320, y: currentY + 5 },
        { label: 'Email', value: data.emailId || data.email || '', x: 70, y: currentY + 28 },
        { label: 'Contact No', value: data.contactNo || '', x: 320, y: currentY + 28 },
        { label: 'Organization', value: data.organization || 'Radiant Appliances', x: 70, y: currentY + 51 },
        { label: 'Request Date', value: data.requestDate || new Date().toLocaleDateString(), x: 320, y: currentY + 51 }
      ];
      
      fields.forEach(field => {
        doc.fillColor('#475569').text(field.label, field.x, field.y);
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text(escapePdfText(field.value), field.x + 60, field.y);
      });
      
      currentY = currentY + 80;
      
      // ====================== ACTIVITY DETAILS ======================
      doc.fillColor('#1e3a8a')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('ACTIVITY DETAILS', 50, currentY);
      
      currentY = doc.y + 10;
      
      doc.roundedRect(50, currentY - 5, doc.page.width - 100, 70, 6)
        .fill('#ffffff')
        .stroke('#e2e8f0');
      
      // Activity Fields
      const vendorName = escapePdfText(data.vendorName || data.vendor || '');
      const priorityValue = data.priority === 'H' ? 'High' : data.priority === 'M' ? 'Medium' : data.priority === 'L' ? 'Low' : (data.priority || 'Medium');
      const priorityColor = priorityValue === 'High' ? '#dc2626' : priorityValue === 'Medium' ? '#d97706' : '#16a34a';
      
      doc.fillColor('#475569')
        .font('Helvetica')
        .fontSize(8)
        .text('Title', 70, currentY + 5);
      doc.fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(escapePdfText(data.titleOfActivity || data.title || '').substring(0, 55), 110, currentY + 5);
      
      doc.fillColor('#475569')
        .text('Vendor Supplier', 70, currentY + 28);
      doc.fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text(escapePdfText(vendorName).substring(0, 35), 180, currentY + 28);
      
      // Priority Badge
      doc.roundedRect(450, currentY + 23, 70, 16, 8).fill(priorityColor);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(priorityValue + ' Priority', 460, currentY + 26);
      
      doc.fillColor('#475569')
        .text('Description', 70, currentY + 51);
      doc.fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(7)
        .text(escapePdfText(data.purposeAndObjective || data.description || 'No description provided').substring(0, 180), 140, currentY + 51, { width: 330 });
      
      currentY = currentY + 75;
      
      // ====================== AMOUNT SECTION ======================
      const amount = data.amount || data.expenseAmount || 0;
      doc.roundedRect(50, currentY, doc.page.width - 100, 45, 6)
        .fill('#e0e7ff')
        .stroke('#c7d2fe');
      
      doc.fillColor('#64748b')
        .fontSize(9)
        .font('Helvetica')
        .text('TOTAL AMOUNT', 70, currentY + 8);
      doc.fillColor('#1e40af')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Rs ' + Number(amount).toLocaleString('en-IN'), 70, currentY + 20);
      
      currentY = currentY + 55;
      
      // ====================== ITEMS TABLE (RFQ) ======================
      if (isRFQ && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('REQUEST ITEMS', 50, currentY);
        
        currentY = doc.y + 8;
        
        const tableTop = currentY;
        
        // Table Header
        doc.rect(50, tableTop - 3, doc.page.width - 100, 18).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(7)
          .font('Helvetica-Bold');
        
        doc.text('No', 55, tableTop);
        doc.text('Item Description', 80, tableTop);
        doc.text('UOM', 280, tableTop);
        doc.text('Qty', 340, tableTop);
        doc.text('Make', 390, tableTop);
        
        let rowY = tableTop + 15;
        let even = false;
        
        for (let idx = 0; idx < Math.min(data.items.length, 8); idx++) {
          const item = data.items[idx];
          if (rowY > 680) break;
          
          if (even) {
            doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(7)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.itemDescription || item.description || '').substring(0, 28), 80, rowY);
          doc.text(escapePdfText(item.uom || 'Pcs'), 280, rowY);
          doc.text((item.quantity || item.qty || 0).toString(), 340, rowY);
          doc.text(escapePdfText(item.make || '').substring(0, 15), 390, rowY);
          
          rowY += 16;
          even = !even;
        }
        
        currentY = rowY + 10;
      }
      
      // ====================== ITEMS TABLE (PO) ======================
      if (isPO && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('ORDER ITEMS', 50, currentY);
        
        currentY = doc.y + 8;
        
        const tableTop = currentY;
        
        // Table Header
        doc.rect(50, tableTop - 3, doc.page.width - 100, 18).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(7)
          .font('Helvetica-Bold');
        
        doc.text('No', 55, tableTop);
        doc.text('Description', 80, tableTop);
        doc.text('Part Code', 230, tableTop);
        doc.text('Qty', 310, tableTop);
        doc.text('Unit Price', 360, tableTop);
        doc.text('Total', 440, tableTop);
        
        let rowY = tableTop + 15;
        let even = false;
        let poTotal = 0;
        
        for (let idx = 0; idx < Math.min(data.items.length, 6); idx++) {
          const item = data.items[idx];
          const base = (item.qty || 0) * (item.unitPrice || 0);
          const gst = base * ((item.cgst || 0) + (item.sgst || 0)) / 100;
          const total = base + gst;
          poTotal += total;
          
          if (rowY > 680) break;
          
          if (even) {
            doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(7)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.partDescription || '').substring(0, 22), 80, rowY);
          doc.text(escapePdfText(item.partCode || '').substring(0, 12), 230, rowY);
          doc.text((item.qty || 0).toString(), 310, rowY);
          doc.text('Rs ' + (item.unitPrice || 0).toLocaleString('en-IN'), 360, rowY);
          doc.text('Rs ' + total.toLocaleString('en-IN'), 440, rowY);
          
          rowY += 16;
          even = !even;
        }
        
        // Grand Total Row
        doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('GRAND TOTAL', 390, rowY);
        doc.text('Rs ' + poTotal.toLocaleString('en-IN'), 440, rowY);
        
        currentY = rowY + 20;
      }
      
      // ====================== ITEMS TABLE (PR) ======================
      if (isPR && data.items && data.items.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('PR ITEMS', 50, currentY);
        
        currentY = doc.y + 8;
        
        const tableTop = currentY;
        
        doc.rect(50, tableTop - 3, doc.page.width - 100, 18).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(7)
          .font('Helvetica-Bold');
        
        doc.text('No', 55, tableTop);
        doc.text('Description', 80, tableTop);
        doc.text('Part Code', 230, tableTop);
        doc.text('Qty', 310, tableTop);
        doc.text('Unit Price', 360, tableTop);
        doc.text('Total', 440, tableTop);
        
        let rowY = tableTop + 15;
        let even = false;
        let prTotal = 0;
        
        for (let idx = 0; idx < Math.min(data.items.length, 6); idx++) {
          const item = data.items[idx];
          const total = (item.qty || 0) * (item.unitPrice || 0);
          prTotal += total;
          
          if (rowY > 680) break;
          
          if (even) {
            doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(7)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(item.partDescription || '').substring(0, 22), 80, rowY);
          doc.text(escapePdfText(item.partCode || '').substring(0, 12), 230, rowY);
          doc.text((item.qty || 0).toString(), 310, rowY);
          doc.text('Rs ' + (item.unitPrice || 0).toLocaleString('en-IN'), 360, rowY);
          doc.text('Rs ' + total.toLocaleString('en-IN'), 440, rowY);
          
          rowY += 16;
          even = !even;
        }
        
        doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('TOTAL VALUE', 390, rowY);
        doc.text('Rs ' + prTotal.toLocaleString('en-IN'), 440, rowY);
        
        currentY = rowY + 20;
      }
      
      // ====================== INVOICES TABLE (PAYMENT) ======================
      if (isPayment && data.invoices && data.invoices.length > 0) {
        doc.fillColor('#1e3a8a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('INVOICES', 50, currentY);
        
        currentY = doc.y + 8;
        
        const tableTop = currentY;
        
        doc.rect(50, tableTop - 3, doc.page.width - 100, 18).fill('#1e3a8a');
        doc.fillColor('#ffffff')
          .fontSize(8)
          .font('Helvetica-Bold');
        
        doc.text('No', 55, tableTop);
        doc.text('Invoice Number', 80, tableTop);
        doc.text('Date', 250, tableTop);
        doc.text('Value', 370, tableTop);
        
        let rowY = tableTop + 15;
        let even = false;
        let invoiceTotal = 0;
        
        for (let idx = 0; idx < Math.min(data.invoices.length, 8); idx++) {
          const inv = data.invoices[idx];
          invoiceTotal += (inv.invoiceValue || 0);
          
          if (rowY > 680) break;
          
          if (even) {
            doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f8fafc');
          }
          
          doc.fillColor('#334155')
            .fontSize(8)
            .font('Helvetica');
          
          doc.text((idx + 1).toString(), 55, rowY);
          doc.text(escapePdfText(inv.invoiceNo || ''), 80, rowY);
          doc.text(escapePdfText(inv.invoiceDate || ''), 250, rowY);
          doc.text('Rs ' + (inv.invoiceValue || 0).toLocaleString('en-IN'), 370, rowY);
          
          rowY += 16;
          even = !even;
        }
        
        doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f1f5f9');
        doc.fillColor('#1e3a8a')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('TOTAL', 340, rowY);
        doc.text('Rs ' + invoiceTotal.toLocaleString('en-IN'), 370, rowY);
        
        currentY = rowY + 20;
      }
      
      // ====================== CC RECIPIENTS ======================
      const ccList = data.ccTo || data.ccList || [];
      if (ccList.length > 0 && currentY < 700) {
        doc.fillColor('#1e3a8a')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('CC RECIPIENTS', 50, currentY);
        
        currentY = doc.y + 5;
        
        doc.roundedRect(50, currentY - 2, doc.page.width - 100, Math.min(ccList.length, 3) * 16 + 8, 5)
          .fill('#f8fafc')
          .stroke('#e2e8f0');
        
        let ccY = currentY + 4;
        for (let i = 0; i < Math.min(ccList.length, 3); i++) {
          doc.fillColor('#1e40af')
            .fontSize(8)
            .font('Helvetica')
            .text('Email  ' + escapePdfText(ccList[i]), 65, ccY);
          ccY += 16;
        }
        
        currentY = ccY + 10;
      }
      
      // ====================== FOOTER ======================
      const footerY = doc.page.height - 45;
      doc.rect(0, footerY, doc.page.width, 45).fill('#f8fafc');
      
      // doc.fillColor('#94a3b8')
      //   .fontSize(7)
      //   .font('Helvetica')
      //   .text('This is an automatically generated document from LCGC RFQ System', 50, footerY + 12, { align: 'center', width: doc.page.width - 100 });
      
      const companyName = process.env.COMPANY_NAME || 'Resolute Group';
      // doc.text('Copyright ' + new Date().getFullYear() + ' ' + escapePdfText(companyName) + ' All rights reserved', 50, footerY + 24, { align: 'center', width: doc.page.width - 100 });
      
      doc.end();
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      reject(error);
    }
  });
};

module.exports = { generateBeautifulPDF };