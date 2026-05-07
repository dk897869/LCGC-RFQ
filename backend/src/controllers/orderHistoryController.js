const OrderHistory = require('../models/OrderHistory');

exports.getOrderHistory = async (req, res) => {
  try {
    const { userId, type } = req.query;
    let query = {};
    if (userId) query.createdBy = userId;
    if (type) query.type = type;
    
    const history = await OrderHistory.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Get Order History error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveOrderHistory = async (req, res) => {
  try {
    const history = new OrderHistory(req.body);
    await history.save();
    res.status(201).json({ success: true, data: history });
  } catch (error) {
    console.error('Save Order History error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderHistoryBySerial = async (req, res) => {
  try {
    const history = await OrderHistory.findOne({ uniqueSerialNo: req.params.serialNo });
    if (!history) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Get Order History by Serial error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};