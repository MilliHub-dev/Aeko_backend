# 🛠️ Setup and Testing Guide for Enhanced Aeko Features

## 📋 Prerequisites

1. **Node.js** (v14 or higher)
2. **MongoDB** (running instance)
3. **Gmail account** (for email sending)
4. **Pinata account** (for IPFS - optional)

## 🔧 Environment Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create or update your `.env` file:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/aeko_backend

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (Gmail)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# IPFS (Optional - for token metadata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET=your_pinata_secret

# Server
PORT=5000
RPC_URL=https://api.devnet.solana.com
```

### 3. Gmail App Password Setup
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification → App passwords
3. Generate app password for "Mail"
4. Use this password in `EMAIL_PASS`

## 🚀 Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server will start at `http://localhost:5000`

## 📚 API Documentation

Visit Swagger UI at: `http://localhost:5000/api-docs`

## 🧪 Testing the Features

### 1. Email Verification System

#### Test User Registration
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "username": "testuser",
    "email": "your_test_email@gmail.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful! Check your email for verification code",
  "userId": "USER_ID_HERE",
  "emailSent": true
}
```

#### Check Your Email
- You should receive a beautiful HTML email with a 4-digit code
- Code expires in 10 minutes

#### Verify Email
```bash
curl -X POST http://localhost:5000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_ABOVE",
    "verificationCode": "1234"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Email verified successfully! Welcome to Aeko!",
  "token": "JWT_TOKEN_HERE",
  "user": {
    "_id": "USER_ID",
    "name": "Test User",
    "username": "testuser",
    "email": "your_test_email@gmail.com",
    "blueTick": false,
    "emailVerification": { "isVerified": true },
         "profileCompletion": {
       "completionPercentage": 25,
       "hasVerifiedEmail": true,
       "hasProfilePicture": false,
       "hasBio": false,
       "hasFollowers": false,
       "hasWalletConnected": false
     }
  }
}
```

#### Test Resend Code
```bash
curl -X POST http://localhost:5000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{ "userId": "USER_ID" }'
```

### 2. Profile Completion & Blue Tick System

#### Check Profile Completion Status
```bash
curl -X GET http://localhost:5000/api/auth/profile-completion \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

 **Expected Response:**
 ```json
 {
   "success": true,
   "profileCompletion": {
     "completionPercentage": 25,
     "hasProfilePicture": false,
     "hasBio": false,
     "hasFollowers": false,
     "hasWalletConnected": false,
     "hasVerifiedEmail": true,
     "blueTick": false,
     "nextSteps": [
       "Add a profile picture",
       "Write a bio (minimum 10 characters)",
       "Get your first follower",
       "Connect your Solana wallet (optional - for Web3 features)"
     ],
     "requirements": {
       "profilePicture": false,
       "bio": false,
       "followers": false,
       "email": true
     },
     "optional": {
       "wallet": false
     }
   }
 }
```

 #### Complete Profile Steps (Simulate)
 To test blue tick awarding, you can manually update the user in MongoDB:
 
 ```javascript
 // In MongoDB, update your user (wallet connection is optional):
 db.users.updateOne(
   { _id: ObjectId("YOUR_USER_ID") },
   {
     $set: {
       profilePicture: "http://example.com/pic.jpg",
       bio: "This is my test bio with more than 10 characters"
     },
     $push: {
       followers: ObjectId("ANOTHER_USER_ID") // Or create a dummy ID
     }
   }
 )
```

After updating, check the profile completion again - the user should now have a blue tick!

### 3. Enhanced Advertisement System

#### Create Advertisement
```bash
curl -X POST http://localhost:5000/api/ads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Advertisement",
    "description": "This is a test ad for our amazing product!",
    "mediaType": "image",
    "mediaUrl": "https://example.com/ad-image.jpg",
    "targetAudience": {
      "age": { "min": 18, "max": 45 },
      "location": ["United States", "Canada"],
      "interests": ["technology", "shopping"],
      "gender": "all"
    },
    "budget": {
      "total": 1000,
      "daily": 50,
      "currency": "USD"
    },
    "pricing": {
      "model": "cpm",
      "bidAmount": 2.50
    },
    "campaign": {
      "objective": "awareness",
      "schedule": {
        "startDate": "2024-12-01T00:00:00Z",
        "endDate": "2024-12-31T23:59:59Z"
      }
    },
    "callToAction": {
      "type": "learn_more",
      "url": "https://example.com",
      "text": "Learn More"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Advertisement created successfully and submitted for review",
  "ad": {
    "_id": "AD_ID_HERE",
    "title": "Test Advertisement",
    "status": "pending",
    "budget": { "total": 1000, "spent": 0 },
    "analytics": { "impressions": 0, "clicks": 0, "ctr": 0 }
  }
}
```

#### Get User's Ads
```bash
curl -X GET http://localhost:5000/api/ads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Targeted Ads (for feed)
```bash
curl -X GET http://localhost:5000/api/ads/targeted?limit=3 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Track Ad Impression
```bash
curl -X POST http://localhost:5000/api/ads/track/impression \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "adId": "AD_ID_FROM_CREATION",
    "metadata": {
      "age": 25,
      "location": "United States",
      "device": "mobile"
    }
  }'
```

#### Track Ad Click
```bash
curl -X POST http://localhost:5000/api/ads/track/click \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{ "adId": "AD_ID_FROM_CREATION" }'
```

#### Get Ad Analytics
```bash
curl -X GET http://localhost:5000/api/ads/AD_ID/analytics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Ad Dashboard
```bash
curl -X GET http://localhost:5000/api/ads/dashboard?timeRange=30d \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Admin Functions

#### Approve Advertisement (Admin Only)
First, make your user an admin in MongoDB:
```javascript
db.users.updateOne(
  { _id: ObjectId("YOUR_USER_ID") },
  { $set: { isAdmin: true } }
)
```

Then approve an ad:
```bash
curl -X POST http://localhost:5000/api/ads/admin/review/AD_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "status": "approved",
    "feedback": "Advertisement approved - looks good!"
  }'
```

## 🔍 Database Verification

### Check User Document
```javascript
// In MongoDB
db.users.findOne({ email: "your_test_email@gmail.com" })
```

You should see:
- `emailVerification.isVerified: true`
- `profileCompletion` object with completion percentage
- `blueTick: true` (if all requirements met)

### Check Ad Document
```javascript
// In MongoDB
db.ads.findOne({ title: "Test Advertisement" })
```

You should see:
- Complete ad structure with analytics
- Targeting options
- Budget tracking

## 🐛 Troubleshooting

### Email Not Sending
1. **Check Gmail credentials** in `.env`
2. **Enable 2FA** and use app password
3. **Check console logs** for email errors
4. **Verify EMAIL_USER and EMAIL_PASS** are correct

### Blue Tick Not Awarded
 1. **Check all requirements** are met:
    - Email verified ✅
    - Profile picture added ✅
    - Bio with 10+ characters ✅
    - At least 1 follower ✅
    - (Wallet connection is optional for blue tick)
2. **Check console logs** for middleware errors
3. **Manually trigger** profile save in MongoDB

### Ads Not Working
1. **Check authentication** - JWT token valid
2. **Verify MongoDB connection**
3. **Check ad status** - must be "approved" for targeting
4. **Review console logs** for validation errors

### MongoDB Connection Issues
1. **Ensure MongoDB is running**
2. **Check MONGODB_URI** in `.env`
3. **Verify database permissions**

## 📊 Expected Test Results

### After Full Testing:
- ✅ **User registered** with email verification
- ✅ **Email sent** with 4-digit code
- ✅ **Welcome email** after verification
- ✅ **Profile completion** tracking works
- ✅ **Blue tick awarded** when requirements met
- ✅ **Blue tick email** sent when earned
- ✅ **Advertisements created** and pending review
- ✅ **Ad analytics** tracking impressions/clicks
- ✅ **Admin approval** workflow functional
- ✅ **Swagger documentation** accessible

## 🎉 Success Indicators

### Email System ✅
- Verification codes received within 1 minute
- HTML emails display correctly
- Rate limiting prevents spam
- Welcome email sent after verification

### Blue Tick System ✅
- Progress percentage calculated correctly
- Next steps provided accurately
- Blue tick awarded automatically
- Congratulations email sent

### Advertisement System ✅
- Ads created with all features
- Targeting system functional
- Analytics tracking working
- Admin review process operational

## 📝 Testing Checklist

### Email Verification
- [ ] Registration sends verification email
- [ ] 4-digit code works within 10 minutes
- [ ] Rate limiting prevents spam (1 min cooldown)
- [ ] Failed attempts limited to 3
- [ ] Welcome email sent after verification
- [ ] Login blocked until email verified

### Blue Tick System
- [ ] Profile completion percentage calculated
- [ ] Next steps provided accurately
- [ ] Blue tick awarded when requirements met
- [ ] Email notification sent for blue tick
- [ ] Requirements validation working

### Advertisement System
- [ ] Ad creation with full feature set
- [ ] Targeting options working
- [ ] Analytics tracking functional
- [ ] Budget management operational
- [ ] Admin review system working
- [ ] Performance dashboard accessible

### API Documentation
- [ ] Swagger UI accessible at `/api-docs`
- [ ] All endpoints documented
- [ ] Request/response examples provided
- [ ] Authentication properly configured

---

## 🚀 Ready for Production!

Once all tests pass, your enhanced Aeko platform is ready with:
- 🔐 **Secure email verification system**
- ✅ **Automated blue tick verification**
- 🎯 **Professional advertisement platform**
- 📊 **Comprehensive analytics**
- 📚 **Complete API documentation**

Happy testing! 🎉