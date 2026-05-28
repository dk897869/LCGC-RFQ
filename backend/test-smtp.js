// test-smtp.js
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('Testing SMTP Configuration...');
  console.log('='.repeat(50));
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'dk897869@gmail.com',
      pass: 'snaq ptsl yqpm hufr'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection successful!');
    
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: '"LCGC Test" <dk897869@gmail.com>',
      to: 'dk897869@gmail.com',
      subject: 'SMTP Test Email',
      text: 'If you see this, SMTP is working!'
    });
    
    console.log('Email sent! Message ID:', info.messageId);
    console.log('Check your inbox at: dk897869@gmail.com');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSMTP();