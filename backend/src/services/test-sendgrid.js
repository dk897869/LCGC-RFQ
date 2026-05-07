require('dotenv').config();
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'dk897869@gmail.com', // Any email address
  from: {
    email: process.env.FROM_EMAIL,
    name: process.env.FROM_NAME
  },
  subject: '✅ Domain Verification Successful!',
  text: 'Your SendGrid is working perfectly!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0f2a5e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .success { color: #10b981; font-size: 48px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LCGC RFQ</h1>
          <p>Resolute Group</p>
        </div>
        <div class="content">
          <div class="success">✅</div>
          <h2>Domain Verified Successfully!</h2>
          <p>Your SendGrid email service is now configured and ready to send emails from <strong>noreply@lcgresolve.com</strong></p>
          <p>You can now send:</p>
          <ul>
            <li>Registration OTPs</li>
            <li>Login OTPs</li>
            <li>Password Reset emails</li>
            <li>EP Approval notifications</li>
          </ul>
          <p>This email is a test to confirm everything is working!</p>
        </div>
      </div>
    </body>
    </html>
  `
};

sgMail.send(msg)
  .then(() => {
    console.log('✅ Email sent successfully!');
    console.log('From:', process.env.FROM_EMAIL);
    console.log('To:', msg.to);
  })
  .catch(error => {
    console.error('❌ Error:', error.response?.body || error);
  });