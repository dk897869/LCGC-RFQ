const Report = require('../models/Report');
const RFQ = require('../models/RFQ');
const PRRequest = require('../models/PRRequest');
const PORequest = require('../models/PORequest');
const PaymentAdvice = require('../models/paymentNpp.model');

exports.generateReport = async (req, res) => {
  try {
    const { fromDate, toDate, type } = req.query;
    let reports = [];
    let summary = {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      inProcess: 0
    };
    
    const dateFilter = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    
    let data = [];
    if (type === 'rfq' || type === 'all') {
      const rfqs = await RFQ.find(dateFilter);
      data.push(...rfqs.map(r => ({ ...r.toObject(), reportType: 'rfq' })));
    }
    if (type === 'pr' || type === 'all') {
      const prs = await PRRequest.find(dateFilter);
      data.push(...prs.map(p => ({ ...p.toObject(), reportType: 'pr' })));
    }
    if (type === 'po' || type === 'all') {
      const pos = await PORequest.find(dateFilter);
      data.push(...pos.map(p => ({ ...p.toObject(), reportType: 'po' })));
    }
    if (type === 'payment' || type === 'all') {
      const payments = await PaymentAdvice.find(dateFilter);
      data.push(...payments.map(p => ({ ...p.toObject(), reportType: 'payment' })));
    }
    
    summary.total = data.length;
    summary.approved = data.filter(d => d.status === 'Approved').length;
    summary.rejected = data.filter(d => d.status === 'Rejected').length;
    summary.pending = data.filter(d => d.status === 'Pending').length;
    summary.inProcess = data.filter(d => d.status === 'In Process').length;
    
    const report = new Report({
      reportType: type || 'all',
      dateFrom: fromDate || '',
      dateTo: toDate || '',
      data: data,
      summary: summary,
      generatedBy: req.user?._id
    });
    await report.save();
    
    res.status(200).json({ success: true, data: data, summary: summary });
  } catch (error) {
    console.error('Generate Report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find().sort({ generatedAt: -1 });
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('Get Reports error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportReportToCSV = async (req, res) => {
  try {
    const { fromDate, toDate, type } = req.query;
    let data = [];
    
    if (type === 'rfq' || type === 'all') {
      const rfqs = await RFQ.find();
      data.push(...rfqs);
    }
    if (type === 'pr' || type === 'all') {
      const prs = await PRRequest.find();
      data.push(...prs);
    }
    if (type === 'po' || type === 'all') {
      const pos = await PORequest.find();
      data.push(...pos);
    }
    if (type === 'payment' || type === 'all') {
      const payments = await PaymentAdvice.find();
      data.push(...payments);
    }
    
    const headers = ['Serial No', 'Title', 'Type', 'Requester', 'Status', 'Amount', 'Date'];
    const rows = data.map(d => [
      d.uniqueSerialNo,
      d.titleOfActivity || d.title || '',
      d.source || '',
      d.requesterName || '',
      d.status,
      d.amount || 0,
      d.createdAt
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export Report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};