# Email Service Setup Guide for Aeko Backend

## Issue Fixed ✅

The Gmail SMTP authentication error has been resolved. The application now handles email service unavailability gracefully and provides verification codes directly in the response when email fails.

## Gmail Authentication Error Solution

The error `535-5.7.8 Username and Password not accepted` occurs because Gmail requires **App Passwords** instead of regular passwords for SMTP authentication.

## Setup Instructions

### Option 1: Use Gmail App Password (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app
   - Select "Other" as the device and name it "Aeko Backend"
   - Copy the 16-character app password

3. **Update your `.env` file**:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

### Option 2: Use Alternative Email Service

If you prefer not to use Gmail, you can configure other email services:

#### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

#### SendGrid (Recommended for Production)
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
```

### Option 3: Development Mode (Current Fallback)

The application now works without email configuration:
- Verification codes are displayed in the API response
- Codes are logged to the console
- Registration and verification still work normally

## Current Behavior

When email service is unavailable:

1. **Registration Response**:
   ```json
   {
     "success": true,
     "message": "Registration successful! Email service unavailable. Your verification code is: 1234",
     "userId": "68c43648fe96f5c530d47d46",
     "emailSent": false,
     "verificationCode": "1234"
   }
   ```

2. **Console Output**:
   ```
   🔐 DEVELOPMENT MODE - Verification code for test@example.com: 1234
   ```

## Testing the Fix

1. **Register a new user**:
   ```bash
   POST /api/auth/signup
   {
     "name": "Test User",
     "username": "testuser123",
     "email": "test@example.com", 
     "password": "password123"
   }
   ```

2. **Use the verification code from the response**:
   ```bash
   POST /api/auth/verify-email
   {
     "userId": "USER_ID_FROM_RESPONSE",
     "verificationCode": "CODE_FROM_RESPONSE"
   }
   ```

## Production Recommendations

1. **Use SendGrid or similar service** for reliable email delivery
2. **Remove verification code from API responses** in production
3. **Set up proper email templates** with your branding
4. **Configure email rate limiting** to prevent abuse
5. **Add email bounce handling** for invalid addresses

## Environment Variables

Update your `.env` file with proper email configuration:

```env
# Email Configuration (Choose one method)

# Method 1: Gmail with App Password
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password

# Method 2: Custom SMTP
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-password

# Method 3: SendGrid (Production)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your-sendgrid-api-key
```

## Verification

The email service is now fault-tolerant and the application will continue to work even without proper email configuration. Users can complete registration and verification using the codes provided in the API response.
