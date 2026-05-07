const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');

const generateSerialNumber = (prefix) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}${month}${day}${hours}${minutes}${seconds}-${random}`;
};

// Generate serial number
router.get('/:type', verifyToken, async (req, res) => {
  try {
    const { type } = req.params;
    let prefix = '';
    switch (type) {
      case 'rfq': prefix = 'RFQ'; break;
      case 'pr': prefix = 'PR'; break;
      case 'po': prefix = 'PO'; break;
      case 'payment': prefix = 'PAY'; break;
      default: return res.status(400).json({ success: false, message: 'Invalid type' });
    }
    const serialNumber = generateSerialNumber(prefix);
    res.status(200).json({ success: true, serialNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Validate serial number
router.get('/validate/:serialNo', verifyToken, async (req, res) => {
  try {
    const { serialNo } = req.params;
    const pattern = /^(RFQ|PR|PO|PAY)-[0-9]{14}-[0-9]{4}$/;
    const isValid = pattern.test(serialNo);
    res.status(200).json({ success: true, isValid: isValid, exists: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;