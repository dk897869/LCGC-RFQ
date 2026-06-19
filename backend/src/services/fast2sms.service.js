// backend/src/services/fast2sms.service.js
const axios = require('axios');

const FAST2SMS_API_KEY = 'xWX9L0fUhYl1cg5vw7NFnRjs3kAp2GqybiHTrzSmBIDJt4Kud8yDa6epRdYAtxPjvIriZohgm1cOfE35';

/**
 * Send SMS using Fast2SMS API
 */
const sendSmsOtp = async (mobileNumber) => {
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Clean mobile number - Keep only 10 digits
    let cleanNumber = mobileNumber.replace(/\D/g, '');
    
    // Remove country code if present
    if (cleanNumber.startsWith('91')) {
      cleanNumber = cleanNumber.substring(2);
    }
    if (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Validate 10-digit number
    if (cleanNumber.length !== 10) {
      console.error('❌ Invalid mobile number length:', cleanNumber.length);
      return {
        success: false,
        error: 'Please enter a valid 10-digit mobile number',
        otp: otp
      };
    }
    
    console.log(`📱 Sending SMS to: ${cleanNumber}`);
    console.log(`🔐 OTP Code: ${otp}`);
    
    // Method 1: Quick SMS Route (Works immediately)
    const response = await axios({
      method: 'GET',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      params: {
        authorization: FAST2SMS_API_KEY,
        route: 'q',  // Quick SMS route
        message: `${otp} is your OTP for LCGC RFQ. Valid for 10 minutes.`,
        numbers: cleanNumber,
        flash: 0
      },
      timeout: 10000
    });
    
    console.log('📡 Fast2SMS Response:', response.data);
    
    // Check if SMS was sent successfully
    if (response.data && response.data.return === true) {
      console.log('✅ SMS sent successfully!');
      return {
        success: true,
        status: 'sent',
        otp: otp,
        message: 'OTP sent successfully'
      };
    } else {
      // If Quick SMS fails, try Bulk SMS route
      console.log('⚠️ Quick SMS failed, trying Bulk SMS route...');
      
      const bulkResponse = await axios({
        method: 'GET',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        params: {
          authorization: FAST2SMS_API_KEY,
          route: 'v3',
          sender_id: 'FAST2SMS',
          message: `${otp} is your OTP for LCGC RFQ. Valid for 10 minutes.`,
          language: 'english',
          flash: 0,
          numbers: cleanNumber
        },
        timeout: 10000
      });
      
      console.log('📡 Bulk SMS Response:', bulkResponse.data);
      
      if (bulkResponse.data && bulkResponse.data.return === true) {
        return {
          success: true,
          status: 'sent',
          otp: otp,
          message: 'OTP sent successfully'
        };
      } else {
        return {
          success: false,
          error: bulkResponse.data?.message || 'Failed to send SMS',
          otp: otp
        };
      }
    }
    
  } catch (error) {
    console.error('❌ Fast2SMS Error:', error.message);
    
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    
    // Return OTP for testing even if SMS fails
    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      success: false,
      error: error.message,
      otp: fallbackOtp,
      isDevMode: true
    };
  }
};

const verifySmsOtp = async (mobileNumber, otp) => {
  return { success: true, isValid: true };
};

module.exports = { sendSmsOtp, verifySmsOtp };