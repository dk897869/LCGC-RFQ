/**
 * PR Quotation Comparison Service
 * Aggregates RFQ-linked vendor quotations and computes lowest-cost vendor per item.
 * Uses MongoDB collections: nppRequest (quotation-comparison, quotation-submission, pr-request), Rfq
 */

const getModel = (path) => {
  try {
    const model = require(path);
    return typeof model?.findById === 'function' ? model : null;
  } catch {
    return null;
  }
};

const NppRequest = getModel('../models/nppRequest.model');
const Rfq = getModel('../models/Rfq');

const normalizeStatus = (s) => {
  const v = String(s || 'Pending');
  if (v.toLowerCase().includes('approve')) return 'Approved';
  if (v.toLowerCase().includes('reject')) return 'Rejected';
  if (v.toLowerCase().includes('process')) return 'In-Process';
  return 'Pending';
};

/**
 * Build comparison from quotation-comparison document items (3-supplier grid)
 */
const buildFromComparisonDoc = (doc) => {
  const items = (doc.quotationItems || []).map((row) => {
    const qty = Number(row.qty || 1);
    const suppliers = [
      { vendorId: 1, vendorName: doc.supplierNames?.[0] || 'Supplier 1', price: Number(row.supplier1Price || 0), amount: Number(row.supplier1Amount || qty * Number(row.supplier1Price || 0)) },
      { vendorId: 2, vendorName: doc.supplierNames?.[1] || 'Supplier 2', price: Number(row.supplier2Price || 0), amount: Number(row.supplier2Amount || qty * Number(row.supplier2Price || 0)) },
      { vendorId: 3, vendorName: doc.supplierNames?.[2] || 'Supplier 3', price: Number(row.supplier3Price || 0), amount: Number(row.supplier3Amount || qty * Number(row.supplier3Price || 0)) }
    ].filter(s => s.price > 0);

    const priced = suppliers.filter(s => s.price > 0);
    const lowest = priced.length
      ? priced.reduce((a, b) => (a.price <= b.price ? a : b))
      : null;

    return {
      partCode: row.partCode || '',
      description: row.partDescription || row.description || '',
      qty,
      suppliers,
      lowestCostVendor: lowest ? { vendorId: lowest.vendorId, vendorName: lowest.vendorName, price: lowest.price } : null,
      selectedVendor: lowest?.vendorName || ''
    };
  });

  const vendorTotals = {};
  items.forEach((item) => {
    item.suppliers.forEach((s) => {
      if (!vendorTotals[s.vendorName]) vendorTotals[s.vendorName] = { vendorId: s.vendorId, vendorName: s.vendorName, total: 0 };
      vendorTotals[s.vendorName].total += Number(s.amount || 0);
    });
  });
  const ranked = Object.values(vendorTotals).sort((a, b) => a.total - b.total);
  const recommended = ranked[0] || null;

  return {
    prId: doc._id,
    rfqNo: doc.rfqNo || '',
    items,
    recommendedVendor: recommended ? { vendorId: recommended.vendorId, vendorName: recommended.vendorName } : null
  };
};

/**
 * Build comparison from quotation-submission rows grouped by part code
 */
const buildFromSubmissions = (submissions, rfqNo) => {
  const byPart = {};
  submissions.forEach((sub) => {
    (sub.quotationSubmissionItems || []).forEach((row, idx) => {
      const key = row.partCode || row.partDescription || `item-${idx}`;
      if (!byPart[key]) {
        byPart[key] = { partCode: row.partCode || '', description: row.partDescription || '', qty: Number(row.qty || 1), suppliers: [] };
      }
      byPart[key].suppliers.push({
        vendorId: byPart[key].suppliers.length + 1,
        vendorName: row.vendorName || sub.requesterName || `Vendor ${byPart[key].suppliers.length + 1}`,
        price: Number(row.unitPrice || 0),
        amount: Number(row.amount || Number(row.qty || 1) * Number(row.unitPrice || 0))
      });
    });
  });

  const items = Object.values(byPart).map((item) => {
    const priced = item.suppliers.filter(s => s.price > 0);
    const lowest = priced.length ? priced.reduce((a, b) => (a.price <= b.price ? a : b)) : null;
    return {
      ...item,
      lowestCostVendor: lowest ? { vendorId: lowest.vendorId, vendorName: lowest.vendorName, price: lowest.price } : null,
      selectedVendor: lowest?.vendorName || ''
    };
  });

  const vendorTotals = {};
  items.forEach((item) => {
    item.suppliers.forEach((s) => {
      if (!vendorTotals[s.vendorName]) vendorTotals[s.vendorName] = { vendorId: s.vendorId, vendorName: s.vendorName, total: 0 };
      vendorTotals[s.vendorName].total += Number(s.amount || 0);
    });
  });
  const ranked = Object.values(vendorTotals).sort((a, b) => a.total - b.total);

  return {
    prId: null,
    rfqNo,
    items,
    recommendedVendor: ranked[0] ? { vendorId: ranked[0].vendorId, vendorName: ranked[0].vendorName } : null
  };
};

exports.getPrComparison = async (prId) => {
  if (!NppRequest) {
    return { prId, items: [], recommendedVendor: null };
  }

  let prDoc = await NppRequest.findById(prId);
  if (!prDoc) {
    const allPr = await NppRequest.find({ type: 'pr-request' }).sort({ createdAt: -1 }).limit(1);
    prDoc = allPr[0] || null;
  }

  const rfqNo = prDoc?.rfqNo || prDoc?.formData?.rfqNo || '';

  const comparisonDoc = await NppRequest.findOne({
    type: 'quotation-comparison',
    ...(rfqNo ? { rfqNo } : {})
  }).sort({ createdAt: -1 });

  if (comparisonDoc?.quotationItems?.length) {
    const result = buildFromComparisonDoc(comparisonDoc);
    result.prId = prId;
    return result;
  }

  const submissions = await NppRequest.find({
    type: 'quotation-submission',
    ...(rfqNo ? { rfqNo } : {})
  }).sort({ createdAt: -1 }).limit(10);

  if (submissions.length) {
    const result = buildFromSubmissions(submissions, rfqNo);
    result.prId = prId;
    return result;
  }

  if (Rfq && rfqNo) {
    const rfq = await Rfq.findOne({ uniqueSerialNo: rfqNo });
    if (rfq?.items?.length) {
      const items = rfq.items.map((row, i) => ({
        partCode: row.itemDescription?.slice(0, 12) || `PART-${i + 1}`,
        description: row.itemDescription || '',
        qty: Number(row.quantity || 1),
        suppliers: [],
        lowestCostVendor: null,
        selectedVendor: ''
      }));
      return { prId, rfqNo, items, recommendedVendor: null };
    }
  }

  if (prDoc?.prItems?.length) {
    const items = prDoc.prItems.map((row) => ({
      partCode: row.partCode || '',
      description: row.partDescription || '',
      qty: Number(row.qty || 1),
      suppliers: row.supplierName ? [{
        vendorId: 1,
        vendorName: row.supplierName,
        price: Number(row.unitPrice || 0),
        amount: Number(row.totalValue || 0)
      }] : [],
      lowestCostVendor: row.supplierName ? {
        vendorId: 1,
        vendorName: row.supplierName,
        price: Number(row.unitPrice || 0)
      } : null,
      selectedVendor: row.supplierName || ''
    }));
    return { prId, rfqNo, items, recommendedVendor: items[0]?.lowestCostVendor || null };
  }

  return { prId, rfqNo, items: [], recommendedVendor: null };
};

exports.getStatusSummary = async (type = 'all') => {
  const models = [];
  const typeMap = {
    ep: ['../models/request'],
    rfq: ['../models/Rfq', '../models/nppRequest.model'],
    pr: ['../models/nppRequest.model'],
    po: ['../models/nppRequest.model', '../models/poNpp.model'],
    payment: ['../models/nppRequest.model', '../models/paymentNpp.model'],
    wcc: ['../models/nppRequest.model'],
    comparison: ['../models/nppRequest.model'],
    'cash-purchase': ['../models/nppRequest.model'],
    all: ['../models/request', '../models/Rfq', '../models/nppRequest.model', '../models/poNpp.model', '../models/paymentNpp.model']
  };
  const paths = typeMap[type] || typeMap.all;
  paths.forEach((p) => {
    const m = getModel(p);
    if (m) models.push(m);
  });

  const summary = { approved: 0, pending: 0, rejected: 0, inProcess: 0, total: 0 };
  const seen = new Set();

  for (const model of models) {
    const filter = type !== 'all' && model.schema?.paths?.type
      ? { type: { $in: [type, `${type}-request`, `${type}-npp`, 'quotation-comparison', 'cash-purchase'].filter(Boolean) } }
      : {};
    const rows = await model.find(filter).select('status type').limit(2000).lean();
    rows.forEach((row) => {
      const id = String(row._id);
      if (seen.has(id)) return;
      seen.add(id);
      const st = normalizeStatus(row.status);
      summary.total += 1;
      if (st === 'Approved') summary.approved += 1;
      else if (st === 'Rejected') summary.rejected += 1;
      else if (st === 'In-Process') summary.inProcess += 1;
      else summary.pending += 1;
    });
  }

  return summary;
};

module.exports.normalizeStatus = normalizeStatus;
