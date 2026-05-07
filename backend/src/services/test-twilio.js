require('dotenv').config();
const { testTwilioConnection, sendSmsOtp, sendEmailOtp } = require('./services/twilio.service');

async function testTwilio() {
  console.log('🔍 Testing Twilio Configuration...\n');
  
  // Test connection
  const isConnected = await testTwilioConnection();
  if (!isConnected) {
    console.error('❌ Twilio connection failed. Check your credentials.');
    return;
  }
  
  // Test SMS (uncomment to test)
  // const smsResult = await sendSmsOtp('+919876543210');
  // console.log('SMS Result:', smsResult);
  
  // Test Email
  const emailResult = await sendEmailOtp(
    'test@example.com',
    'Test User',
    '123456',
    'login'
  );
  console.log('Email Result:', emailResult);
}

testTwilio();