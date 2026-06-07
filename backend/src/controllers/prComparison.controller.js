const comparisonService = require('../services/prComparison.service');

exports.getComparison = async (req, res) => {
  try {
    const { prId } = req.params;
    const data = await comparisonService.getPrComparison(prId);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStatusSummary = async (req, res) => {
  try {
    const type = req.query.type || req.params.type || 'all';
    const data = await comparisonService.getStatusSummary(type);
    res.status(200).json({ success: true, data, summary: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
