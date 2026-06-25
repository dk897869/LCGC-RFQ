const Quotation = require('../models/Quotation');
const RFQ = require('../models/Rfq');
const VendorRequest = require('../models/VendorRequest');
const { sendMail } = require('../services/mail.service');

// Submit quotation
exports.submitQuotation = async (req, res) => {
  try {
    const {
      rfqId,
      vendorId,
      vendorRequestId,
      price,
      gst,
      discount,
      deliveryDays,
      warranty,
      paymentTerms,
      remarks,
      attachments
    } = req.body;

    if (!rfqId || !vendorId || !price) {
      return res.status(400).json({
        success: false,
        message: 'RFQ ID, Vendor ID, and Price are required'
      });
    }

    // Check if quotation already exists for this vendor
    const existing = await Quotation.findOne({ rfqId, vendorId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Quotation already submitted for this vendor'
      });
    }

    const quotation = new Quotation({
      rfqId,
      vendorId,
      vendorRequestId,
      price,
      gst: gst || 0,
      discount: discount || 0,
      deliveryDays: deliveryDays || 0,
      warranty: warranty || '',
      paymentTerms: paymentTerms || '',
      remarks: remarks || '',
      attachments: attachments || [],
      status: 'Submitted',
      submittedDate: new Date()
    });

    await quotation.save();

    // Update vendor request status
    if (vendorRequestId) {
      const vendorRequest = await VendorRequest.findById(vendorRequestId);
      if (vendorRequest) {
        const vendorIndex = vendorRequest.vendors.findIndex(
          v => v.vendorId?.toString() === vendorId
        );
        if (vendorIndex !== -1) {
          vendorRequest.vendors[vendorIndex].quotationSubmitted = true;
          vendorRequest.vendors[vendorIndex].quotationId = quotation._id;
          vendorRequest.vendors[vendorIndex].submittedDate = new Date();
          vendorRequest.vendors[vendorIndex].status = 'Quoted';
          await vendorRequest.save();
        }
      }
    }

    // Check if all vendors have submitted or at least one quotation received
    const rfq = await RFQ.findById(rfqId);
    if (rfq) {
      const allQuotations = await Quotation.find({ rfqId });
      
      // Get total vendors count
      const vendorRequest = await VendorRequest.findOne({ rfqId });
      const totalVendors = vendorRequest?.vendors?.length || 0;
      const submittedCount = allQuotations.length;

      // Update RFQ quotation status
      if (!rfq.quotationCompleted && (submittedCount >= 1 || submittedCount >= totalVendors)) {
        rfq.quotationCompleted = true;
        rfq.currentStage = 'Quotation Status';
        await rfq.save();

        // Send notification to admin (non-blocking)
        try {
          const adminEmails = await getAdminReviewerEmails();
          const ccList = rfq.ccTo || [];
          await sendMail({
            to: adminEmails,
            cc: ccList,
            subject: `📊 Quotations Received: ${rfq.uniqueSerialNo}`,
            html: `
              <h2>Quotation Received</h2>
              <p>RFQ: <strong>${rfq.uniqueSerialNo}</strong></p>
              <p>Title: ${rfq.titleOfActivity}</p>
              <p>Number of quotations received: ${submittedCount}</p>
              <p>Please review and compare quotations.</p>
            `
          });
        } catch (emailErr) {
          console.error('⚠️ Quotation notification error:', emailErr.message);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Quotation submitted successfully',
      data: quotation
    });

  } catch (error) {
    console.error('Submit quotation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get quotations by RFQ ID
exports.getQuotationsByRfqId = async (req, res) => {
  try {
    const quotations = await Quotation.find({ rfqId: req.params.rfqId })
      .populate('vendorId', 'name company email phone')
      .sort({ totalAmount: 1 });

    res.json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get quotation comparison
exports.getQuotationComparison = async (req, res) => {
  try {
    const { rfqId } = req.params;

    const quotations = await Quotation.find({ rfqId })
      .populate('vendorId', 'name company email phone')
      .sort({ totalAmount: 1 });

    if (!quotations.length) {
      return res.status(404).json({
        success: false,
        message: 'No quotations found for this RFQ'
      });
    }

    // Calculate comparison data
    const comparisonData = quotations.map((q, index) => {
      const total = q.totalAmount || (q.price + q.gst + (q.tax || 0) + (q.shipping || 0) - q.discount);
      return {
        id: q._id,
        vendorId: q.vendorId?._id || q.vendorId,
        vendorName: q.vendorId?.name || 'Unknown Vendor',
        company: q.vendorId?.company || '',
        email: q.vendorId?.email || '',
        basePrice: q.price,
        gst: q.gst || 0,
        discount: q.discount || 0,
        totalAmount: total,
        deliveryDays: q.deliveryDays || 0,
        warranty: q.warranty || '',
        paymentTerms: q.paymentTerms || '',
        remarks: q.remarks || '',
        status: q.status,
        rank: index + 1,
        isLowest: index === 0,
        isRecommended: index === 0 // Lowest price vendor is recommended
      };
    });

    res.json({
      success: true,
      data: comparisonData,
      summary: {
        totalQuotations: quotations.length,
        lowestPrice: comparisonData[0]?.totalAmount || 0,
        lowestVendor: comparisonData[0]?.vendorName || '',
        recommendedVendor: comparisonData[0]?.vendorName || ''
      }
    });

  } catch (error) {
    console.error('Get quotation comparison error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update quotation status
exports.updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const quotation = await Quotation.findByIdAndUpdate(
      id,
      { 
        status, 
        remarks, 
        updatedAt: new Date(),
        ...(status === 'Approved' ? { approvedDate: new Date() } : {}),
        ...(status === 'Rejected' ? { rejectedDate: new Date() } : {})
      },
      { new: true }
    );

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Update vendor status in vendor request
    const vendorRequest = await VendorRequest.findOne({ rfqId: quotation.rfqId });
    if (vendorRequest) {
      const vendor = vendorRequest.vendors.find(
        v => v.vendorId?.toString() === quotation.vendorId?.toString()
      );
      if (vendor) {
        vendor.status = status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Pending';
        await vendorRequest.save();
      }
    }

    res.json({
      success: true,
      message: `Quotation ${status.toLowerCase()} successfully`,
      data: quotation
    });

  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Select winner
exports.selectWinner = async (req, res) => {
  try {
    const { rfqId } = req.params;
    const { quotationId, vendorId, vendorName, finalPrice, remarks } = req.body;

    if (!quotationId || !vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Quotation ID and Vendor ID are required'
      });
    }

    // Update RFQ with winner
    const rfq = await RFQ.findByIdAndUpdate(
      rfqId,
      {
        winnerVendorId: vendorId,
        winnerVendorName: vendorName || 'Unknown Vendor',
        winnerPrice: finalPrice || 0,
        status: 'Vendor Finalized',
        currentStage: 'Completed',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    // Update quotation as winner
    await Quotation.findByIdAndUpdate(
      quotationId,
      { status: 'Winner', updatedAt: new Date() }
    );

    // Update other quotations as rejected
    await Quotation.updateMany(
      { rfqId, _id: { $ne: quotationId } },
      { status: 'Rejected', updatedAt: new Date() }
    );

    // Send winner notification (non-blocking)
    try {
      const adminEmails = await getAdminReviewerEmails();
      await sendMail({
        to: adminEmails,
        cc: rfq.ccTo || [],
        subject: `🏆 Winner Selected: ${rfq.uniqueSerialNo}`,
        html: `
          <h2>Winner Selected</h2>
          <p>RFQ: <strong>${rfq.uniqueSerialNo}</strong></p>
          <p>Title: ${rfq.titleOfActivity}</p>
          <p>Winner: <strong>${vendorName || 'Unknown Vendor'}</strong></p>
          <p>Final Price: ₹${finalPrice?.toLocaleString() || 0}</p>
          ${remarks ? `<p>Remarks: ${remarks}</p>` : ''}
          <p>The RFQ process is now complete.</p>
        `
      });
    } catch (emailErr) {
      console.error('⚠️ Winner notification error:', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Winner selected successfully',
      data: rfq
    });

  } catch (error) {
    console.error('Select winner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to get admin emails
const getAdminReviewerEmails = async () => {
  try {
    const User = require('../models/user.model');
    const reviewers = await User.find({
      role: { $in: ['Admin', 'Manager', 'Senior Manager'] },
      isActive: { $ne: false }
    }).select('email').lean();
    return reviewers.map((u) => u.email).filter(Boolean);
  } catch (error) {
    console.error('Admin reviewer lookup failed:', error.message);
    return [];
  }
};