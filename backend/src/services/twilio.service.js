// services/twilio.service.js
const twilio = require('twilio');

// Twilio configuration with proper defaults and error handling
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC63450241f366aa28dffce878beh5dcbc';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'e696629ee6ae8b15486f43f4f4337626';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || null; // Don't default to invalid number

// Log configuration status (without exposing full credentials)
console.log('📱 Twilio Configuration Status:', {
  hasAccountSid: !!accountSid && accountSid !== 'AC63450241f366aa28dffce878beh5dcbc',
  hasAuthToken: !!authToken && authToken !== 'e696629ee6ae8b15486f43f4f4337626',
  hasPhoneNumber: !!twilioPhoneNumber && twilioPhoneNumber !== '6239785524',
  isConfigured: !!(accountSid && authToken && twilioPhoneNumber && 
                   accountSid !== 'AC63450241f366aa28dffce878beh5dcbc' &&
                   twilioPhoneNumber !== '+916239785524')
});

// Initialize Twilio client only if credentials are provided
let client = null;
try {
  if (accountSid && authToken && accountSid !== 'AC63450241f366aa28dffce878beh5dcbc') {
    client = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized');
  } else {
    console.log('⚠️ Twilio client not initialized - using development mode');
  }
} catch (error) {
  console.error('❌ Failed to initialize Twilio client:', error.message);
}

// Development mode flag
const isDevelopment = process.env.NODE_ENV === 'development';
const useRealSms = process.env.USE_REAL_SMS === 'true' && !isDevelopment;

/**
 * Send SMS OTP - Optimized for speed
 * @param {string} mobileNumber - Mobile number with or without country code
 * @returns {Promise<Object>} - Result object with success status and OTP
 */
const sendSmsOtp = async (mobileNumber) => {
  const startTime = Date.now();
  
  try {
    // Validate mobile number
    if (!mobileNumber || mobileNumber.trim() === '') {
      return {
        success: false,
        error: 'Mobile number is required',
        retry: false
      };
    }
    
    // Clean and format mobile number
    let cleanNumber = mobileNumber.replace(/\D/g, '');
    
    // Remove leading zero if present
    if (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Add country code if not present (default to +91 for India)
    let formattedNumber = cleanNumber;
    if (!mobileNumber.startsWith('+')) {
      if (cleanNumber.length === 10) {
        formattedNumber = '+91' + cleanNumber;
      } else if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
        formattedNumber = '+' + cleanNumber;
      } else if (cleanNumber.length > 10) {
        formattedNumber = '+' + cleanNumber;
      } else {
        formattedNumber = '+91' + cleanNumber;
      }
    } else {
      formattedNumber = mobileNumber;
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📱 Sending SMS OTP to ${formattedNumber}: ${otp}`);
    
    // DEVELOPMENT MODE - Fast response (no actual SMS)
    if (isDevelopment && !useRealSms) {
      console.log('⚠️ DEVELOPMENT MODE: OTP sent via console only (no actual SMS)');
      
      // Simulate network delay (100-200ms for realistic testing)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const duration = Date.now() - startTime;
      console.log(`✅ Development mode - OTP: ${otp} (sent in ${duration}ms)`);
      
      return {
        success: true,
        status: 'development',
        otp: otp,
        sid: `DEV_${Date.now()}`,
        message: 'Development mode - OTP sent via console',
        duration: duration
      };
    }
    
    // Check if Twilio is configured properly
    if (!client) {
      console.error('❌ Twilio client not initialized. Please check your credentials.');
      return {
        success: false,
        error: 'SMS service not configured. Please contact support.',
        retry: false,
        fallback: true,
        otp: isDevelopment ? otp : null
      };
    }
    
    if (!twilioPhoneNumber || twilioPhoneNumber === '+916239785524') {
      console.error('❌ Twilio phone number not configured');
      return {
        success: false,
        error: 'SMS service not configured. Please set TWILIO_PHONE_NUMBER.',
        retry: false,
        fallback: true,
        otp: isDevelopment ? otp : null
      };
    }
    
    // PRODUCTION MODE - Send actual SMS with timeout
    try {
      // Create message promise with timeout
      const messagePromise = client.messages.create({
        body: `Your verification code is: ${otp}. This code will expire in 10 minutes.`,
        from: twilioPhoneNumber,
        to: formattedNumber
      });
      
      // Race between SMS sending and timeout (5 seconds)
      const message = await Promise.race([
        messagePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMS timeout after 5 seconds')), 5000)
        )
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ SMS sent successfully in ${duration}ms:`, message.sid);
      
      return {
        success: true,
        status: 'sent',
        sid: message.sid,
        otp: otp,
        message: 'OTP sent successfully',
        duration: duration
      };
      
    } catch (timeoutError) {
      console.error('❌ SMS timeout:', timeoutError.message);
      return {
        success: false,
        error: 'SMS service timeout. Please try again.',
        retry: true,
        duration: Date.now() - startTime
      };
    }
    
  } catch (error) {
    console.error('❌ Twilio SMS Error:', error);
    
    // Handle specific Twilio errors
    if (error.code === 21609) {
      return {
        success: false,
        error: 'Trial account restriction: Please add your number as a verified caller ID in Twilio Console.',
        retry: false,
        details: 'https://console.twilio.com/us1/account/phone-numbers/verified'
      };
    }
    
    if (error.code === 21211) {
      return {
        success: false,
        error: 'Invalid phone number format. Please check the number and try again.',
        retry: false
      };
    }
    
    if (error.code === 21408) {
      return {
        success: false,
        error: 'Permission error: Unable to send SMS to this number.',
        retry: false
      };
    }
    
    // Generic error
    return {
      success: false,
      error: error.message || 'Failed to send SMS. Please try again.',
      retry: true,
      duration: Date.now() - startTime
    };
  }
};

/**
 * Verify SMS OTP - Fast verification
 * @param {string} mobileNumber - Mobile number
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object>} - Verification result
 */
const verifySmsOtp = async (mobileNumber, otp) => {
  // This function is just a wrapper - actual verification happens in database
  // Fast response (no external API call)
  return {
    success: true,
    isValid: true
  };
};

/**
 * Test Twilio connection
 * @returns {Promise<Object>} - Connection test result
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
    // Test by fetching account info (fast operation)
    const account = await Promise.race([
      client.api.accounts(accountSid).fetch(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]);
    
    return {
      success: true,
      message: 'Twilio connection successful',
      accountStatus: account.status,
      configured: true
    };
  } catch (error) {
    return {
      success: false,
      message: `Twilio connection failed: ${error.message}`,
      configured: true
    };
  }
};

module.exports = { 
  sendSmsOtp, 
  verifySmsOtp,
  testTwilioConnection
};