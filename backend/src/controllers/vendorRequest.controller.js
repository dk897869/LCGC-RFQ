const VendorRequest = require('../models/VendorRequest');
const RFQ = require('../models/Rfq');
const { sendMail } = require('../services/mail.service');

// Create vendor request
exports.createVendorRequest = async (req, res) => {
  try {
    const { rfqId, rfqNumber, vendors, createdBy } = req.body;

    if (!rfqId || !vendors || vendors.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'RFQ ID and at least one vendor are required' 
      });
    }

    // Check if vendor request already exists
    const existing = await VendorRequest.findOne({ rfqId });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vendor request already exists for this RFQ' 
      });
    }

    // Create vendor request
    const vendorRequest = new VendorRequest({
      rfqId,
      rfqNumber,
      vendors: vendors.map(v => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        email: v.email,
        company: v.company || '',
        phone: v.phone || '',
        status: 'Pending',
        remarks: v.remarks || '',
        quotationSubmitted: false,
        quotationId: null,
        submittedDate: null
      })),
      createdBy: createdBy || req.user?.id,
      createdDate: new Date(),
      status: 'Sent'
    });

    await vendorRequest.save();

    // Update RFQ
    await RFQ.findByIdAndUpdate(rfqId, {
      vendorRequestCreated: true,
      currentStage: 'Vendor Request Sent',
      vendorRequestId: vendorRequest._id
    });

    // Send emails to vendors (non-blocking)
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      for (const vendor of vendors) {
        if (vendor.email) {
          await sendMail({
            to: vendor.email,
            subject: `RFQ Invitation: ${rfqNumber}`,
            html: `
              <h2>RFQ Invitation</h2>
              <p>Dear ${vendor.vendorName || 'Vendor'},</p>
              <p>You have been invited to submit a quotation for RFQ: <strong>${rfqNumber}</strong></p>
              <p>Please login to the vendor portal to view the RFQ details and submit your quotation.</p>
              <p><a href="${frontendUrl}/vendor/rfq/${rfqId}" style="display:inline-block;padding:10px 20px;background:#1e3a8a;color:white;text-decoration:none;border-radius:6px;">View RFQ</a></p>
              <p>Thank you.</p>
            `
          });
        }
      }
    } catch (emailErr) {
      console.error('⚠️ Vendor email error (non-blocking):', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Vendor request created and sent successfully',
      data: vendorRequest
    });

  } catch (error) {
    console.error('Create vendor request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all vendor requests
exports.getAllVendorRequests = async (req, res) => {
  try {
    const { rfqId, status } = req.query;
    let filter = {};
    if (rfqId) filter.rfqId = rfqId;
    if (status) filter.status = status;

    const requests = await VendorRequest.find(filter)
      .populate('rfqId', 'uniqueSerialNo titleOfActivity requesterName department')
      .sort({ createdDate: -1 });

    res.json({ 
      success: true, 
      count: requests.length,
      data: requests 
    });
  } catch (error) {
    console.error('Get vendor requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor request by RFQ ID
exports.getVendorRequestByRfqId = async (req, res) => {
  try {
    const request = await VendorRequest.findOne({ 
      rfqId: req.params.rfqId 
    }).populate('rfqId', 'uniqueSerialNo titleOfActivity requesterName department items');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor request not found' 
      });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get vendor request by RFQ error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor request by ID
exports.getVendorRequestById = async (req, res) => {
  try {
    const request = await VendorRequest.findById(req.params.id)
      .populate('rfqId', 'uniqueSerialNo titleOfActivity requesterName department items stakeholders');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor request not found' 
      });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get vendor request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update vendor request
exports.updateVendorRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const request = await VendorRequest.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor request not found' 
      });
    }

    res.json({
      success: true,
      message: 'Vendor request updated successfully',
      data: request
    });
  } catch (error) {
    console.error('Update vendor request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update vendor status in request
exports.updateVendorStatus = async (req, res) => {
  try {
    const { id, vendorIndex } = req.params;
    const { status, remarks } = req.body;

    const request = await VendorRequest.findById(id);
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor request not found' 
      });
    }

    const vendor = request.vendors[vendorIndex];
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found in request' 
      });
    }

    vendor.status = status;
    if (remarks) vendor.remarks = remarks;
    if (status === 'Quoted') {
      vendor.quotationSubmitted = true;
      vendor.submittedDate = new Date();
    }

    await request.save();

    res.json({
      success: true,
      message: 'Vendor status updated successfully',
      data: request
    });
  } catch (error) {
    console.error('Update vendor status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete vendor request
exports.deleteVendorRequest = async (req, res) => {
  try {
    const request = await VendorRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor request not found' 
      });
    }

    // Update RFQ
    await RFQ.findByIdAndUpdate(request.rfqId, {
      vendorRequestCreated: false,
      currentStage: 'Vendor Request'
    });

    res.json({
      success: true,
      message: 'Vendor request deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};