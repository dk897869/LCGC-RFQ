// services/twilio.service.js
const twilio = require('twilio');

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const yourPersonalNumber = process.env.YOUR_PERSONAL_NUMBER || '+916239785524';

const isDevelopment = process.env.NODE_ENV === 'development';
const useRealSms = process.env.USE_REAL_SMS === 'true';

console.log('📱 ========================================');
console.log('📱 TWILIO CONFIGURATION');
console.log('📱 ========================================');
console.log(`✅ Account SID: ${accountSid ? 'Present' : 'Missing'}`);
console.log(`✅ Auth Token: ${authToken ? 'Present' : 'Missing'}`);
console.log(`✅ Twilio Number: ${twilioPhoneNumber || 'Not set'}`);
console.log(`📱 Your Number (receiver): ${yourPersonalNumber}`);
console.log(`🌍 Environment: ${isDevelopment ? 'Development' : 'Production'}`);
console.log(`📤 Real SMS: ${useRealSms ? 'ENABLED' : 'Disabled'}`);
console.log('📱 ========================================\n');

// Initialize Twilio client
let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully\n');
  } catch (err) {
    console.error('❌ Twilio init error:', err.message);
  }
} else {
  console.warn('⚠️ Twilio credentials missing. SMS will not work.\n');
}

/**
 * Send SMS OTP - Fully working version
 * @param {string} mobileNumber - Phone number to send OTP to (your personal number)
 * @returns {Promise<Object>} - Result object
 */
const sendSmsOtp = async (mobileNumber) => {
  const startTime = Date.now();
  
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Clean and format the recipient's mobile number (your personal number)
    let recipientNumber = mobileNumber.replace(/\D/g, '');
    
    // Format Indian number with +91
    if (recipientNumber.length === 10) {
      recipientNumber = '+91' + recipientNumber;
    } else if (recipientNumber.length === 12 && recipientNumber.startsWith('91')) {
      recipientNumber = '+' + recipientNumber;
    } else if (!recipientNumber.startsWith('+')) {
      recipientNumber = '+91' + recipientNumber;
    }
    
    console.log(`📱 Sending OTP to: ${recipientNumber}`);
    console.log(`🔐 OTP Code: ${otp}`);
    
    // DEVELOPMENT MODE - No real SMS
    if (isDevelopment || !useRealSms) {
      console.log('⚠️ DEVELOPMENT MODE: No SMS sent (check console for OTP)');
      console.log(`📱 [DEV] OTP for ${recipientNumber}: ${otp}\n`);
      
      return {
        success: true,
        status: 'development',
        otp: otp,
        message: 'Development mode - Check server logs for OTP',
        isDevMode: true
      };
    }
    
    // PRODUCTION MODE - Send real SMS
    if (!client) {
      console.error('❌ Twilio client not initialized');
      return {
        success: false,
        error: 'SMS service not configured. Please check Twilio credentials.',
        otp: otp // Return OTP for fallback
      };
    }
    
    if (!twilioPhoneNumber || twilioPhoneNumber === '+1234567890') {
      console.error('❌ Invalid Twilio phone number:', twilioPhoneNumber);
      return {
        success: false,
        error: 'Twilio phone number not configured. Please buy a number from Twilio Console.',
        otp: otp
      };
    }
    
    console.log(`📤 Sending REAL SMS from: ${twilioPhoneNumber} to: ${recipientNumber}`);
    
    // Send SMS with timeout
    const messagePromise = client.messages.create({
      body: `Your verification code is: ${otp}. This code will expire in 10 minutes. - LCGC RFQ`,
      from: twilioPhoneNumber,
      to: recipientNumber
    });
    
    // Race with timeout (10 seconds)
    const message = await Promise.race([
      messagePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMS timeout after 10 seconds')), 10000)
      )
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ SMS sent successfully in ${duration}ms!`);
    console.log(`📨 Message SID: ${message.sid}\n`);
    
    return {
      success: true,
      status: 'sent',
      sid: message.sid,
      otp: otp,
      duration: duration,
      message: 'OTP sent successfully to your mobile number'
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ SMS failed after ${duration}ms:`);
    console.error(`Error: ${error.message}`);
    
    // Handle specific Twilio errors
    if (error.code === 21609) {
      console.error(`
⚠️ TRIAL ACCOUNT RESTRICTION:
   You can only send SMS to VERIFIED numbers.
   
   To fix this:
   1. Go to: https://console.twilio.com/us1/account/phone-numbers/verified
   2. Click "Add a new Caller ID"
   3. Enter your number: ${yourPersonalNumber}
   4. Verify with the code Twilio sends
   5. Wait 5 minutes for verification
      `);
      
      return {
        success: false,
        error: 'Trial account: Please verify your number in Twilio Console first',
        needsVerification: true,
        verificationUrl: 'https://console.twilio.com/us1/account/phone-numbers/verified',
        otp: otp // Return OTP for testing
      };
    }
    
    if (error.code === 21211) {
      console.error('❌ Invalid phone number format');
      return {
        success: false,
        error: 'Invalid phone number format. Please use 10-digit number.',
        otp: otp
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
      otp: otp
    };
  }
};

/**
 * Verify SMS OTP
 * @param {string} mobileNumber - Mobile number
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object>} - Verification result
 */
const verifySmsOtp = async (mobileNumber, otp) => {
  // Verification happens in database
  // This function is just a wrapper
  return { 
    success: true, 
    isValid: true,
    message: 'OTP verification handled by database'
  };
};

/**
 * Test Twilio connection
 */
const testTwilioConnection = async () => {
  if (!client) {
    return {
      success: false,
      message: 'Twilio client not initialized',
      configured: false
    };
  }
  
  try {
    const account = await client.api.accounts(accountSid).fetch();
    return {
      success: true,
      message: 'Twilio connection successful',
      accountName: account.friendlyName,
      accountStatus: account.status,
      configured: true
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      configured: true
    };
  }
};

module.exports = { 
  sendSmsOtp, 
  verifySmsOtp,
  testTwilioConnection
};