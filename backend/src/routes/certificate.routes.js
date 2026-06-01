// routes/certificate.routes.js
const express = require('express');
const router = express.Router();
const Certificate = require('../models/certificate.model');
const NPPRequest = require('../models/nppRequest.model');
const EPRequest = require('../models/request');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Inline auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Generate certificate for WCC request
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { requestId, requestData, type = 'wcc' } = req.body;

    if (!requestId && !requestData) {
      return res.status(400).json({
        success: false,
        message: 'Request ID or request data is required'
      });
    }

    let certificateData = {};
    let sourceRequest = null;

    // Try to fetch from database if requestId is provided
    if (requestId) {
      try {
        sourceRequest = await NPPRequest.findOne({ 
          $or: [{ _id: requestId }, { uniqueSerialNo: requestId }] 
        });
        
        if (!sourceRequest && type === 'ep') {
          sourceRequest = await EPRequest.findOne({ 
            $or: [{ _id: requestId }, { uniqueSerialNo: requestId }] 
          });
        }
      } catch (err) {
        console.log('Request fetch error:', err.message);
      }

      if (sourceRequest) {
        certificateData = {
          requestId: sourceRequest._id,
          requestType: sourceRequest.type || type,
          serialNo: sourceRequest.uniqueSerialNo,
          title: sourceRequest.titleOfActivity || sourceRequest.title,
          requesterName: sourceRequest.requesterName || sourceRequest.requester,
          vendorName: sourceRequest.vendorName || sourceRequest.vendor,
          poNo: sourceRequest.poNo,
          workDescription: sourceRequest.workDescription || sourceRequest.description,
          natureOfWork: sourceRequest.natureOfWork,
          overallScore: sourceRequest.overallScore || 0,
          finalDecision: sourceRequest.finalDecision || 'Accept & close',
          ratings: sourceRequest.ratings || [],
          generatedBy: req.user?.name || req.user?.email,
          generatedAt: new Date()
        };
      }
    }

    // Use provided requestData if available
    if (requestData) {
      certificateData = {
        ...certificateData,
        ...requestData,
        requestId: requestData.id || requestId,
        serialNo: requestData.serialNo || requestData.uniqueSerialNo || certificateData.serialNo,
        title: requestData.title || certificateData.title,
        requesterName: requestData.requester || requestData.requesterName || certificateData.requesterName,
        vendorName: requestData.vendor || requestData.vendorName || certificateData.vendorName,
        workDescription: requestData.workDescription || requestData.description || certificateData.workDescription,
        overallScore: requestData.overallScore || certificateData.overallScore || 0,
        generatedBy: req.user?.name || req.user?.email,
        generatedAt: new Date()
      };
    }

    // Generate unique certificate ID
    const certificateId = `CERT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create certificate record
    const certificate = new Certificate({
      certificateId,
      requestId: certificateData.requestId || requestId,
      requestType: type,
      serialNo: certificateData.serialNo || `WCC-${Date.now()}`,
      data: certificateData,
      generatedBy: req.user?._id || req.user?.id,
      generatedAt: new Date(),
      downloadCount: 0
    });

    await certificate.save();

    // Generate certificate URL
    const certificateUrl = `/api/certificates/${certificate._id}/preview`;

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      data: {
        id: certificate._id,
        certificateId: certificate.certificateId,
        serialNo: certificate.serialNo,
        generatedAt: certificate.generatedAt,
        url: certificateUrl,
        data: certificateData
      }
    });

  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get certificates by request ID
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { requestId, type } = req.query;

    let filter = {};
    if (requestId && requestId !== 'undefined' && requestId !== 'null') {
      filter.requestId = requestId;
    }
    if (type) {
      filter.requestType = type;
    }

    const certificates = await Certificate.find(filter)
      .sort({ generatedAt: -1 })
      .populate('generatedBy', 'name email');

    res.json({
      success: true,
      count: certificates.length,
      data: certificates.map(cert => ({
        id: cert._id,
        certificateId: cert.certificateId,
        requestId: cert.requestId,
        serialNo: cert.serialNo,
        generatedAt: cert.generatedAt,
        downloadCount: cert.downloadCount,
        data: cert.data
      }))
    });

  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get single certificate by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate('generatedBy', 'name email');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: certificate._id,
        certificateId: certificate.certificateId,
        requestId: certificate.requestId,
        serialNo: certificate.serialNo,
        generatedAt: certificate.generatedAt,
        downloadCount: certificate.downloadCount,
        data: certificate.data
      }
    });

  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Preview certificate (HTML)
router.get('/:id/preview', authMiddleware, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).send('Certificate not found');
    }

    const data = certificate.data;
    const scorePercentage = (data.overallScore / 5) * 100;
    const scoreColor = data.overallScore >= 4 ? '#10b981' : data.overallScore >= 3 ? '#3b82f6' : data.overallScore >= 2 ? '#f59e0b' : '#ef4444';
    
    const getRatingLabel = (score) => {
      if (score >= 4.5) return 'Excellent';
      if (score >= 3.5) return 'Very Good';
      if (score >= 2.5) return 'Good';
      if (score >= 1.5) return 'Average';
      return 'Needs Improvement';
    };

    const getRatingEmoji = (score) => {
      if (score >= 4.5) return '🌟';
      if (score >= 3.5) return '⭐';
      if (score >= 2.5) return '👍';
      if (score >= 1.5) return '👌';
      return '⚠️';
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Work Completion Certificate - ${certificate.serialNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
            padding: 40px;
            min-height: 100vh;
          }
          .certificate-container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
          }
          .certificate-header {
            background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
          }
          .certificate-header h1 {
            font-size: 32px;
            margin-bottom: 8px;
            letter-spacing: 2px;
          }
          .certificate-header p {
            opacity: 0.8;
            font-size: 14px;
          }
          .certificate-seal {
            position: absolute;
            right: 40px;
            top: 40px;
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            border: 2px solid rgba(255,255,255,0.3);
          }
          .certificate-body {
            padding: 40px;
          }
          .certificate-number {
            background: #f8fafc;
            padding: 12px 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          .certificate-number span {
            font-weight: 700;
            color: #0f2a5e;
            font-family: monospace;
            font-size: 16px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-item {
            background: #f8fafc;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          .info-item label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #94a3b8;
            display: block;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
          }
          .info-item .value {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
          }
          .full-width {
            grid-column: 1 / -1;
          }
          .score-section {
            background: linear-gradient(135deg, #f0fdf4, #dcfce7);
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 30px;
            text-align: center;
          }
          .score-circle {
            width: 120px;
            height: 120px;
            margin: 0 auto 16px;
            border-radius: 50%;
            background: conic-gradient(${scoreColor} 0deg, ${scoreColor} ${scorePercentage * 3.6}deg, #e2e8f0 ${scorePercentage * 3.6}deg);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          .score-circle::before {
            content: '';
            position: absolute;
            width: 90px;
            height: 90px;
            background: white;
            border-radius: 50%;
          }
          .score-value {
            position: relative;
            z-index: 1;
            font-size: 28px;
            font-weight: 800;
            color: #0f2a5e;
          }
          .score-label {
            font-size: 14px;
            font-weight: 600;
            color: #065f46;
          }
          .rating-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .rating-table th {
            background: #f1f5f9;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
          }
          .rating-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px dashed #e2e8f0;
          }
          .signature-line {
            text-align: center;
            width: 200px;
          }
          .signature-line .line {
            border-bottom: 1px solid #cbd5e1;
            margin-bottom: 8px;
            padding-top: 20px;
          }
          .signature-line .label {
            font-size: 11px;
            color: #94a3b8;
          }
          .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
          }
          @media print {
            body { background: white; padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="certificate-header">
            <h1>WORK COMPLETION CERTIFICATE</h1>
            <p>LCGC Resolute Group</p>
            <div class="certificate-seal">📜</div>
          </div>
          <div class="certificate-body">
            <div class="certificate-number">
              <span>Certificate No: ${certificate.certificateId || certificate.serialNo}</span>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <label>PO / WO Number</label>
                <div class="value">${data.poNo || '—'}</div>
              </div>
              <div class="info-item">
                <label>Vendor Name</label>
                <div class="value">${data.vendorName || '—'}</div>
              </div>
              <div class="info-item">
                <label>Nature of Work</label>
                <div class="value">${data.natureOfWork || '—'}</div>
              </div>
              <div class="info-item">
                <label>Requester Name</label>
                <div class="value">${data.requesterName || '—'}</div>
              </div>
              <div class="info-item full-width">
                <label>Work Description</label>
                <div class="value">${data.workDescription || '—'}</div>
              </div>
            </div>

            <div class="score-section">
              <div class="score-circle">
                <div class="score-value">${data.overallScore || 0}</div>
              </div>
              <div class="score-label">Overall Performance Score (out of 5)</div>
              <div style="margin-top: 8px; font-size: 18px; font-weight: 700; color: ${scoreColor}">
                ${getRatingLabel(data.overallScore || 0)} ${getRatingEmoji(data.overallScore || 0)}
              </div>
            </div>

            <table class="rating-table">
              <thead>
                <tr><th>Parameter</th><th>Weight</th><th>Rating (1-5)</th><th>Remark</th></tr>
              </thead>
              <tbody>
                ${(data.ratings || []).map(r => `
                  <tr>
                    <td>${r.head || '—'}</td>
                    <td>${r.weight || 0}%</td>
                    <td>${r.rating || 0}</td>
                    <td>${r.remark || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="signature-section">
              <div class="signature-line">
                <div class="line"></div>
                <div class="label">Issued By</div>
              </div>
              <div class="signature-line">
                <div class="line"></div>
                <div class="label">Authorized Signatory</div>
              </div>
              <div class="signature-line">
                <div class="line"></div>
                <div class="label">Date: ${new Date(certificate.generatedAt).toLocaleDateString('en-GB')}</div>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>This is a system-generated certificate.</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px;" class="no-print">
          <button onclick="window.print()" style="background: #0f2a5e; color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; margin: 0 10px;">🖨️ Print Certificate</button>
          <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer;">✕ Close</button>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Preview certificate error:', error);
    res.status(500).send('Error generating certificate preview');
  }
});

// Download certificate
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Increment download count
    certificate.downloadCount += 1;
    await certificate.save();

    const data = certificate.data;
    const scorePercentage = (data.overallScore / 5) * 100;
    const scoreColor = data.overallScore >= 4 ? '#10b981' : data.overallScore >= 3 ? '#3b82f6' : data.overallScore >= 2 ? '#f59e0b' : '#ef4444';
    
    const getRatingLabel = (score) => {
      if (score >= 4.5) return 'Excellent';
      if (score >= 3.5) return 'Very Good';
      if (score >= 2.5) return 'Good';
      if (score >= 1.5) return 'Average';
      return 'Needs Improvement';
    };

    const getRatingEmoji = (score) => {
      if (score >= 4.5) return '🌟';
      if (score >= 3.5) return '⭐';
      if (score >= 2.5) return '👍';
      if (score >= 1.5) return '👌';
      return '⚠️';
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Work Completion Certificate - ${certificate.serialNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: white;
            padding: 40px;
          }
          .certificate-container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            overflow: hidden;
          }
          .certificate-header {
            background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          .certificate-header h1 { font-size: 32px; margin-bottom: 8px; }
          .certificate-body { padding: 40px; }
          .certificate-number {
            background: #f8fafc;
            padding: 12px 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-item {
            background: #f8fafc;
            padding: 16px;
            border-radius: 12px;
          }
          .info-item label {
            font-size: 11px;
            font-weight: 700;
            color: #94a3b8;
            display: block;
            margin-bottom: 6px;
          }
          .score-section {
            background: #f0fdf4;
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 30px;
            text-align: center;
          }
          .score-value {
            font-size: 32px;
            font-weight: 800;
            color: #0f2a5e;
          }
          .rating-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .rating-table th, .rating-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
          }
          .rating-table th {
            background: #f1f5f9;
            font-weight: 700;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px dashed #e2e8f0;
          }
          .signature-line {
            text-align: center;
            width: 200px;
          }
          .signature-line .line {
            border-bottom: 1px solid #cbd5e1;
            margin-bottom: 8px;
            padding-top: 20px;
          }
          .footer {
            background: #f8fafc;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="certificate-header">
            <h1>WORK COMPLETION CERTIFICATE</h1>
            <p>LCGC Resolute Group</p>
          </div>
          <div class="certificate-body">
            <div class="certificate-number">Certificate No: ${certificate.certificateId || certificate.serialNo}</div>
            <div class="info-grid">
              <div class="info-item"><label>PO / WO Number</label><div>${data.poNo || '—'}</div></div>
              <div class="info-item"><label>Vendor Name</label><div>${data.vendorName || '—'}</div></div>
              <div class="info-item"><label>Nature of Work</label><div>${data.natureOfWork || '—'}</div></div>
              <div class="info-item"><label>Requester</label><div>${data.requesterName || '—'}</div></div>
            </div>
            <div class="score-section">
              <div class="score-value">Overall Score: ${data.overallScore || 0} / 5</div>
              <div>${getRatingLabel(data.overallScore || 0)} ${getRatingEmoji(data.overallScore || 0)}</div>
            </div>
            <table class="rating-table">
              <thead><tr><th>Parameter</th><th>Rating</th><th>Remark</th></tr></thead>
              <tbody>
                ${(data.ratings || []).map(r => `<tr><td>${r.head || '—'}</td><td>${r.rating || 0}</td><td>${r.remark || '—'}</td></tr>`).join('')}
              </tbody>
            </table>
            <div class="signature-section">
              <div class="signature-line"><div class="line"></div><div class="label">Issued By</div></div>
              <div class="signature-line"><div class="line"></div><div class="label">Authorized Signatory</div></div>
              <div class="signature-line"><div class="line"></div><div class="label">Date: ${new Date().toLocaleDateString()}</div></div>
            </div>
          </div>
          <div class="footer">This is a system-generated certificate.</div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="certificate_${certificate.certificateId}.html"`);
    res.send(html);

  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete certificate
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const certificate = await Certificate.findByIdAndDelete(req.params.id);
    
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      message: 'Certificate deleted successfully'
    });

  } catch (error) {
    console.error('Delete certificate error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;