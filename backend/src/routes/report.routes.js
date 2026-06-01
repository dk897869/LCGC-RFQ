const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

const safeModel = (path) => {
  try {
    const model = require(path);
    return typeof model?.find === 'function' ? model : null;
  } catch {
    return null;
  }
};

const normalizeRows = (rows, type) => rows.map((row) => {
  const item = typeof row.toObject === 'function' ? row.toObject() : row;
  return {
    ...item,
    type: item.type || type,
    uniqueSerialNo: item.uniqueSerialNo || item.serialNo || '',
    titleOfActivity: item.titleOfActivity || item.title || item.subject || '',
    requesterName: item.requesterName || item.requester || item.createdByName || '',
    amount: Number(item.amount || item.estimatedAmount || item.paymentDetails?.expenseAmount || 0),
    requestDate: item.requestDate || item.createdAt,
    status: item.status || 'Pending'
  };
});

const buildDateFilter = (fromDate, toDate) => {
  if (!fromDate && !toDate) return {};
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { $or: [{ createdAt: range }, { requestDate: range }] };
};

const buildSearchFilter = (search) => {
  if (!search) return {};
  const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return {};
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [
      { uniqueSerialNo: regex },
      { rfqNo: regex },
      { titleOfActivity: regex },
      { requesterName: regex },
      { 'rfqVendorItems.rfqNo': regex },
      { 'quotationItems.rfqNo': regex },
      { 'quotationSubmissionItems.rfqNo': regex },
      { 'prItems.rfqNo': regex }
    ]
  };
};

const loadReportRows = async ({ fromDate, toDate, type = 'all', search = '' }) => {
  const dateFilter = buildDateFilter(fromDate, toDate);
  const searchFilter = buildSearchFilter(search);
  const rows = [];

  const NPPRequest = safeModel('../models/nppRequest.model');
  const RFQ = safeModel('../models/Rfq');
  const EPRequest = safeModel('../models/request');

  if (NPPRequest) {
    const nppFilter = { ...dateFilter, ...searchFilter };
    if (type && type !== 'all') {
      const map = {
        rfq: ['rfq-vendor', 'rfq-requisition'],
        quotation: ['quotation-submission', 'quotation-comparison'],
        comparison: ['quotation-comparison'],
        pr: ['pr-request'],
        po: ['po-npp'],
        payment: ['payment-advise'],
        wcc: ['wcc-npp']
      };
      nppFilter.type = map[type] ? { $in: map[type] } : type;
    }
    rows.push(...normalizeRows(await NPPRequest.find(nppFilter).sort({ createdAt: -1 }).limit(1000), 'npp'));
  }

  if ((!type || type === 'all' || type === 'rfq') && RFQ) {
    rows.push(...normalizeRows(await RFQ.find({ ...dateFilter, ...searchFilter }).sort({ createdAt: -1 }).limit(500), 'rfq'));
  }

  if ((!type || type === 'all' || type === 'ep') && EPRequest) {
    rows.push(...normalizeRows(await EPRequest.find(dateFilter).sort({ createdAt: -1 }).limit(500), 'ep'));
  }

  return rows.sort((a, b) => new Date(b.createdAt || b.requestDate || 0) - new Date(a.createdAt || a.requestDate || 0));
};

const summarize = (rows) => ({
  totalRequests: rows.length,
  total: rows.length,
  approved: rows.filter(r => r.status === 'Approved').length,
  rejected: rows.filter(r => r.status === 'Rejected').length,
  pending: rows.filter(r => r.status === 'Pending').length,
  inProcess: rows.filter(r => ['In-Process', 'In Process'].includes(r.status)).length
});

// Generate reports
router.get('/generate', authMiddleware, async (req, res) => {
  try {
    const { fromDate, toDate, type, search } = req.query;
    const details = await loadReportRows({ fromDate, toDate, type, search });
    const reportData = {
      summary: summarize(details),
      details,
      filters: { fromDate, toDate, type, search }
    };
    
    res.json({
      success: true,
      data: reportData,
      message: 'Report generated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export report
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const rows = await loadReportRows(req.query);
    const headers = ['Serial No', 'Type', 'Title', 'Requester', 'Status', 'Amount', 'Date'];
    const csvData = [
      headers.join(','),
      ...rows.map(row => [
        row.uniqueSerialNo,
        row.type,
        `"${String(row.titleOfActivity || '').replace(/"/g, '""')}"`,
        `"${String(row.requesterName || '').replace(/"/g, '""')}"`,
        row.status,
        row.amount,
        row.requestDate || row.createdAt || ''
      ].join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=lcgc_report_${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
