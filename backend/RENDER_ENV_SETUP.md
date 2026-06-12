# LCGC RFQ - Production Environment Variables (Render.com)

Set these in your Render Web Service → Environment:

## Required
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-strong-secret
JWT_EXPIRES=7d
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://lcgc-rfq-frontend.onrender.com
```

## SMTP (Email OTP + all form notifications)
```
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password-no-spaces
```

For Gmail: use App Password (Google Account → Security → 2-Step Verification → App passwords).

## Mobile OTP (choose one)
```
FAST2SMS_API_KEY=your-fast2sms-key
USE_REAL_SMS=true
```

Or Twilio:
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
USE_REAL_SMS=true
```

## Verify deployment
- GET https://lcgc-rfq.onrender.com/api/health → check `smtp.ready: true`
- POST https://lcgc-rfq.onrender.com/api/test-email-direct with body `{"email":"your@email.com"}`
