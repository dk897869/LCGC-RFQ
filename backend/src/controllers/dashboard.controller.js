const comparisonService = require('../services/prComparison.service');

const getModel = (path) => {
  try {
    const model = require(path);
    return typeof model?.countDocuments === 'function' ? model : null;
  } catch {
    return null;
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const summary = await comparisonService.getStatusSummary('all');

    const Vendor = getModel('../models/vendor.model');
    const Part = getModel('../models/part.model');

    let vendorCount = 0;
    let partCount = 0;
    if (Vendor) vendorCount = await Vendor.countDocuments().catch(() => 0);
    if (Part) partCount = await Part.countDocuments().catch(() => 0);

    const successRate = summary.total
      ? Math.round((summary.approved / summary.total) * 1000) / 10
      : 0;

    res.json({
      success: true,
      data: {
        totalRequests: summary.total,
        pending: summary.pending,
        approved: summary.approved,
        rejected: summary.rejected,
        inProcess: summary.inProcess,
        successRate,
        vendorCount,
        partCount
      },
      summary
    });
  } catch (error) {
    res.json({
      success: true,
      data: { totalRequests: 0, pending: 0, approved: 0, rejected: 0, successRate: 0 },
      message: error.message
    });
  }
};
