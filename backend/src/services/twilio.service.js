const twilio = require('twilio');
const { sendMail } = require('./mail.service');

let twilioClient = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  
  if (!sid || !token) {
    console.error('❌ Twilio credentials missing. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
    return null;
  }
  
  console.log('✅ Twilio client initialized with SID:', sid.substring(0, 6) + '...');
  twilioClient = twilio(sid, token);
  return twilioClient;
}

// Note: If you don't have Verify Service SID, we'll use direct SMS sending
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

// Fallback method: Direct SMS without Verify Service
const sendDirectSmsOtp = async (phoneNumber, otp) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      return { success: false, error: 'Twilio client not configured' };
    }

    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = `+91${phoneNumber.replace(/\D/g, '')}`;
    }

    console.log(`📱 Sending direct SMS OTP to: ${formattedNumber}`);

    const message = await client.messages.create({
      body: `Your OTP for LCGC RFQ is: ${otp}. Valid for 10 minutes. Please do not share this OTP with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber,
    });

    console.log(`✅ SMS sent successfully. SID: ${message.sid}`);
    return {
      success: true,
      sid: message.sid,
      status: message.status,
      to: formattedNumber,
    };
  } catch (error) {
    console.error('❌ Direct SMS error:', error.message);
    if (error.code === 21610) {
      return { success: false, error: 'Trial account restriction. Please verify the recipient number in Twilio console.' };
    }
    return { success: false, error: error.message, code: error.code };
  }
};

const sendSmsOtp = async (phoneNumber, customOtp = null) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.warn('⚠️ Twilio SMS: missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN');
      return { success: false, error: 'Twilio is not configured' };
    }

    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = `+91${phoneNumber.replace(/\D/g, '')}`;
    }

    console.log(`📱 Sending SMS OTP to: ${formattedNumber}`);

    // If Verify Service is configured, use it
    if (VERIFY_SERVICE_SID) {
      try {
        const verification = await client.verify.v2
          .services(VERIFY_SERVICE_SID)
          .verifications.create({
            to: formattedNumber,
            channel: 'sms',
          });

        console.log(`✅ Verify Service OTP sent. SID: ${verification.sid}`);
        return {
          success: true,
          sid: verification.sid,
          status: verification.status,
          to: formattedNumber,
          method: 'verify-service'
        };
      } catch (verifyError) {
        console.warn('⚠️ Verify Service failed, falling back to direct SMS:', verifyError.message);
        // Fallback to direct SMS
        const otp = customOtp || Math.floor(100000 + Math.random() * 900000).toString();
        return await sendDirectSmsOtp(formattedNumber, otp);
      }
    } else {
      // Direct SMS without Verify Service
      const otp = customOtp || Math.floor(100000 + Math.random() * 900000).toString();
      return await sendDirectSmsOtp(formattedNumber, otp);
    }
  } catch (error) {
    console.error('❌ SMS OTP error:', error.message);
    return { success: false, error: error.message, code: error.code };
  }
};

const verifySmsOtp = async (phoneNumber, code) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      return { success: false, isValid: false, error: 'Twilio is not configured' };
    }

    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = `+91${phoneNumber.replace(/\D/g, '')}`;
    }

    // If Verify Service is configured, use it for verification
    if (VERIFY_SERVICE_SID) {
      try {
        const verificationCheck = await client.verify.v2
          .services(VERIFY_SERVICE_SID)
          .verificationChecks.create({
            to: formattedNumber,
            code: code,
          });

        const isValid = verificationCheck.status === 'approved';
        console.log(`✅ Verify Service verification result: ${isValid ? 'approved' : 'rejected'}`);
        return {
          success: true,
          isValid,
          status: verificationCheck.status,
          sid: verificationCheck.sid,
          method: 'verify-service'
        };
      } catch (verifyError) {
        console.error('❌ Verify Service verification failed:', verifyError.message);
        return { success: false, isValid: false, error: verifyError.message };
      }
    } else {
      // Without Verify Service, we need to verify against stored OTP
      // You should implement OTP storage (Redis, DB, or memory cache)
      console.warn('⚠️ Verify Service not configured. Please implement OTP storage for verification.');
      return { 
        success: false, 
        isValid: false, 
        error: 'OTP verification requires Verify Service or OTP storage implementation' 
      };
    }
  } catch (error) {
    console.error('❌ SMS verification error:', error.message);
    return { success: false, isValid: false, error: error.message };
  }
};

const sendEmailOtp = async (email, name, otp, type) => {
  let subject = '';
  let title = '';

  switch (type) {
    case 'login':
      subject = 'Your Login OTP - LCGC RFQ';
      title = 'Login Verification';
      break;
    case 'registration':
      subject = 'Verify Your Email - LCGC RFQ';
      title = 'Email Verification';
      break;
    case 'reset':
      subject = 'Password Reset OTP - LCGC RFQ';
      title = 'Password Reset';
      break;
    default:
      subject = 'Your OTP - LCGC RFQ';
      title = 'OTP Verification';
  }

  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0f2a5e 0%, #1e4a8a 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .greeting { font-size: 16px; color: #333; margin-bottom: 20px; }
          .otp-container { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; border: 1px solid #e2e8f0; }
          .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #0f2a5e; font-family: 'Courier New', monospace; }
          .validity { color: #64748b; font-size: 14px; margin-top: 15px; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #64748b; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LCGC RFQ System</h1>
          </div>
          <div class="content">
            <div class="greeting">
              <strong>Hello ${name},</strong>
            </div>
            <p>You have requested to ${title.toLowerCase()} for your account.</p>
            <div class="otp-container">
              <div style="font-size: 14px; color: #64748b; margin-bottom: 10px;">Your One-Time Password (OTP) is:</div>
              <div class="otp-code">${otp}</div>
            </div>
            <div class="validity">
              ⏰ This OTP is valid for <strong>10 minutes</strong><br>
              🔒 For security reasons, never share this OTP with anyone.
            </div>
          </div>
          <div class="footer">
            <p>© 2024 LCGC RFQ System. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

  const text = `Hello ${name},\n\nYour OTP for ${title.toLowerCase()} is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nFor security reasons, never share this OTP with anyone.\n\n© 2024 LCGC RFQ System`;

  try {
    const r = await sendMail({
      to: email,
      subject,
      html,
      text,
    });
    
    if (!r.success) {
      console.error('❌ Email send failed:', r.error);
      return { success: false, error: r.error || 'Email send failed' };
    }
    
    console.log(`✅ Email OTP sent to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Email OTP error:', error.message);
    return { success: false, error: error.message };
  }
};

// Helper function to generate random OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Test Twilio connection
const testTwilioConnection = async () => {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.error('❌ Twilio client not configured');
      return false;
    }
    
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('✅ Twilio connection successful!');
    console.log('Account Name:', account.friendlyName);
    console.log('Account Status:', account.status);
    return true;
  } catch (error) {
    console.error('❌ Twilio connection test failed:', error.message);
    return false;
  }
};

// Export all functions
module.exports = {
  sendSmsOtp,
  verifySmsOtp,
  sendEmailOtp,
  generateOtp,
  testTwilioConnection,
  sendDirectSmsOtp, // Export for direct SMS needs
};