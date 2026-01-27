# Aeko Backend API Documentation

Base URL: `https://dev.aeko.social`

Version: 2.0.0
Description: 
# Aeko Backend API Documentation

Welcome to the comprehensive API documentation for Aeko, the **Social Media Platform** featuring advanced real-time communication.

**Aeko** is a next-generation social media platform that merges the best features of short-form video sharing, microblogging, and photo-based networking, enhanced by AI capabilities. It aims to provide a decentralized, immersive, and rewarding experience for content creators and consumers alike.
Aeko combines a rich set of social features, including an enhanced chat system, AI bot personalities, and unique community tools.

## 🚀 Core Features

### 🌐 Social Features
- **User management** and authentication
- **Social media features** (posts, comments, likes, shares)
- **Post ownership** and transfer system
- **Engagement tracking** with view counting
- **Advertisement system** with crypto payments
- **Challenge and debate systems**
- **Space/community features** with token gating
- **Subscription-based content** and monetization
- **Profile management** with status updates







### 📱 Enhanced Chat System
- **Real-time messaging** with Socket.IO
- **Voice messages** with audio recording
- **Emoji reactions** and advanced emoji support
- **AI Bot integration** with 7 personalities
- **File sharing** (images, videos, documents, audio)
- **Typing indicators** and presence management
- **Read receipts** and message status tracking
- **Message search** and conversation history
- **Group chats** and advanced chat management

### 🤖 AI Bot Personalities
1. **Friendly** 😊 - Warm and approachable
2. **Professional** 💼 - Business-oriented and formal
3. **Sarcastic** 😏 - Witty with dry humor
4. **Creative** 🎨 - Imaginative and artistic
5. **Analytical** 📊 - Data-driven and logical
6. **Mentor** 🧙 - Educational and supportive
7. **Companion** 🤝 - Empathetic and understanding


## 🔐 Authentication

Most endpoints require JWT authentication. Include your token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 🌐 Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://api.aeko.com`



## 📡 Real-Time Communication

The enhanced chat system uses **Socket.IO** for real-time features:
- **Endpoint**: `ws://localhost:5000`
- **Authentication**: JWT token required
- **Features**: Instant messaging, voice recording, emoji reactions, AI bot responses

## 📁 File Upload Support

- **Maximum file size**: 100MB
- **Supported formats**: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, AVI), Audio (MP3, WAV, OGG), Documents (PDF, DOC, TXT)
- **Voice messages**: WebM audio with waveform data
        

## AI Bot

### Chat with AI bot

**Endpoint:** `POST /api/enhanced-chat/bot-chat`

Send message to AI bot with customizable personality and get intelligent response

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "message": "string",
  "chatId": "string",
  "personality": "string",
  "instruction": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| message | string | - |
| chatId | string | - |
| personality | string | - |
| instruction | string | - |

#### Responses

**200**: Bot response generated successfully

---

## Admin

### Get advertisements for admin review

**Endpoint:** `GET /api/ads/admin/review`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | - |
| page | query | integer | No | - |
| limit | query | integer | No | - |

#### Responses

**200**: Ads for review retrieved successfully

---

### Review advertisement (admin only)

**Endpoint:** `POST /api/ads/admin/review/{adId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "status": "string",
  "rejectionReason": "string",
  "feedback": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| status | string | - |
| rejectionReason | string | - |
| feedback | string | - |

#### Responses

**200**: Advertisement reviewed successfully

---

## Advertisements

### Create new advertisement

**Endpoint:** `POST /api/ads`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "title": "Summer Sale - 50% Off",
  "description": "Don't miss our biggest summer sale!",
  "mediaType": "string",
  "mediaUrl": "https://example.com/ad-image.jpg",
  "targetAudience": {
    "age": {
      "min": 18,
      "max": 45
    },
    "location": [
      "string"
    ],
    "interests": [
      "string"
    ]
  },
  "budget": {
    "total": 1000,
    "daily": 50,
    "currency": "USD"
  },
  "pricing": {
    "model": "string",
    "bidAmount": 2.5
  },
  "campaign": {
    "objective": "string",
    "schedule": {
      "startDate": "string",
      "endDate": "string"
    }
  },
  "callToAction": {
    "type": "string",
    "url": "string",
    "text": "string"
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| title | string | - |
| description | string | - |
| mediaType | string | - |
| mediaUrl | string | - |
| targetAudience | object | - |
| budget | object | - |
| pricing | object | - |
| campaign | object | - |
| callToAction | object | - |

#### Responses

**201**: Advertisement created successfully

```json
{
  "success": true,
  "message": "Advertisement created successfully and submitted for review",
  "ad": {
    "_id": "string",
    "title": "Summer Sale - 50% Off",
    "description": "Don't miss our biggest summer sale with amazing discounts!",
    "mediaType": "string",
    "mediaUrl": "string",
    "targetAudience": {
      "age": "...",
      "location": "...",
      "interests": "...",
      "gender": "..."
    },
    "budget": {
      "total": "...",
      "daily": "...",
      "spent": "...",
      "currency": "..."
    },
    "pricing": {
      "model": "...",
      "bidAmount": "..."
    },
    "campaign": {
      "objective": "...",
      "schedule": "..."
    },
    "status": "string",
    "analytics": {
      "impressions": "...",
      "clicks": "...",
      "ctr": "...",
      "conversions": "...",
      "conversionRate": "..."
    },
    "advertiserId": "...",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**400**: Bad request - validation errors

**401**: Unauthorized

---

### Get user's advertisements

**Endpoint:** `GET /api/ads`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | Filter ads by status |
| page | query | integer | No | Page number |
| limit | query | integer | No | Number of ads per page |

#### Responses

**200**: User advertisements retrieved successfully

```json
{
  "success": true,
  "data": {
    "ads": [
      "..."
    ],
    "pagination": {
      "current": 0,
      "pages": 0,
      "total": 0
    }
  }
}
```

---

### Get targeted advertisements for user

**Endpoint:** `GET /api/ads/targeted`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| limit | query | integer | No | Number of ads to return |

#### Responses

**200**: Targeted ads retrieved successfully

```json
{
  "success": true,
  "data": {
    "ads": [
      "..."
    ],
    "count": 0
  }
}
```

---

### Track advertisement impression

**Endpoint:** `POST /api/ads/track/impression`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "metadata": {
    "age": 0,
    "location": "string",
    "device": "string"
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | Advertisement ID |
| metadata | object | - |

#### Responses

**200**: Impression tracked successfully

**400**: Bad request

**404**: Advertisement not found

---

### Track advertisement click

**Endpoint:** `POST /api/ads/track/click`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "metadata": {}
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | Advertisement ID |
| metadata | object | - |

#### Responses

**200**: Click tracked successfully

---

### Track advertisement conversion

**Endpoint:** `POST /api/ads/track/conversion`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "conversionValue": 0,
  "conversionType": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | - |
| conversionValue | number | - |
| conversionType | string | - |

#### Responses

**200**: Conversion tracked successfully

---

### Get advertisement analytics

**Endpoint:** `GET /api/ads/{adId}/analytics`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |
| timeRange | query | string | No | - |

#### Responses

**200**: Analytics retrieved successfully

```json
{
  "success": true,
  "data": {
    "overview": {
      "impressions": 0,
      "clicks": 0,
      "ctr": 0,
      "conversions": 0,
      "conversionRate": 0,
      "performanceScore": 0
    },
    "budget": {
      "total": 0,
      "spent": 0,
      "remaining": 0
    }
  }
}
```

---

### Update advertisement

**Endpoint:** `PUT /api/ads/{adId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "title": "string",
  "description": "string",
  "status": "string",
  "budget": {}
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| title | string | - |
| description | string | - |
| status | string | - |
| budget | object | - |

#### Responses

**200**: Advertisement updated successfully

---

### Delete advertisement

**Endpoint:** `DELETE /api/ads/{adId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |

#### Responses

**200**: Advertisement deleted successfully

**400**: Cannot delete running advertisement

---

### Get advertisement dashboard

**Endpoint:** `GET /api/ads/dashboard`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| timeRange | query | string | No | - |

#### Responses

**200**: Dashboard data retrieved successfully

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAds": 0,
      "activeAds": 0,
      "totalSpent": 0,
      "totalImpressions": 0,
      "totalClicks": 0,
      "averageCTR": 0
    }
  }
}
```

---

### Get advertisements for admin review

**Endpoint:** `GET /api/ads/admin/review`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | - |
| page | query | integer | No | - |
| limit | query | integer | No | - |

#### Responses

**200**: Ads for review retrieved successfully

---

### Review advertisement (admin only)

**Endpoint:** `POST /api/ads/admin/review/{adId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "status": "string",
  "rejectionReason": "string",
  "feedback": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| status | string | - |
| rejectionReason | string | - |
| feedback | string | - |

#### Responses

**200**: Advertisement reviewed successfully

---

## Analytics

### Track advertisement impression

**Endpoint:** `POST /api/ads/track/impression`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "metadata": {
    "age": 0,
    "location": "string",
    "device": "string"
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | Advertisement ID |
| metadata | object | - |

#### Responses

**200**: Impression tracked successfully

**400**: Bad request

**404**: Advertisement not found

---

### Track advertisement click

**Endpoint:** `POST /api/ads/track/click`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "metadata": {}
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | Advertisement ID |
| metadata | object | - |

#### Responses

**200**: Click tracked successfully

---

### Track advertisement conversion

**Endpoint:** `POST /api/ads/track/conversion`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "adId": "string",
  "conversionValue": 0,
  "conversionType": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| adId | string | - |
| conversionValue | number | - |
| conversionType | string | - |

#### Responses

**200**: Conversion tracked successfully

---

### Get advertisement analytics

**Endpoint:** `GET /api/ads/{adId}/analytics`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes | - |
| timeRange | query | string | No | - |

#### Responses

**200**: Analytics retrieved successfully

```json
{
  "success": true,
  "data": {
    "overview": {
      "impressions": 0,
      "clicks": 0,
      "ctr": 0,
      "conversions": 0,
      "conversionRate": 0,
      "performanceScore": 0
    },
    "budget": {
      "total": 0,
      "spent": 0,
      "remaining": 0
    }
  }
}
```

---

### Get advertisement dashboard

**Endpoint:** `GET /api/ads/dashboard`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| timeRange | query | string | No | - |

#### Responses

**200**: Dashboard data retrieved successfully

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAds": 0,
      "activeAds": 0,
      "totalSpent": 0,
      "totalImpressions": 0,
      "totalClicks": 0,
      "averageCTR": 0
    }
  }
}
```

---

## Authentication

### User registration with email verification

**Endpoint:** `POST /api/auth/signup`

#### Request Body

Content-Type: `application/json`

```json
{
  "name": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| name | string | User's full name |
| username | string | Unique username |
| email | string | User's email address |
| password | string | User's password |

#### Responses

**201**: User registered successfully, verification code sent

```json
{
  "success": true,
  "message": "Registration successful! Check your email for verification code",
  "userId": "string"
}
```

**400**: Bad request - validation errors

**409**: User already exists

---

### Verify email with 4-digit code

**Endpoint:** `POST /api/auth/verify-email`

#### Request Body

Content-Type: `application/json`

```json
{
  "userId": "string",
  "verificationCode": "1234"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| userId | string | User ID from registration |
| verificationCode | string | 4-digit verification code |

#### Responses

**200**: Email verified successfully

```json
{
  "success": true,
  "message": "Email verified successfully",
  "token": "string",
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "profilePicture": "string",
    "status": "string",
    "botEnabled": true,
    "botPersonality": "string",
    "isAdmin": true,
    "id": "string",
    "name": "string",
    "bio": "string",
    "blueTick": true,
    "goldenTick": true,
    "emailVerification": {
      "isVerified": "..."
    },
    "profileCompletion": {
      "completionPercentage": "...",
      "hasProfilePicture": "...",
      "hasBio": "...",
      "hasFollowers": "...",
      "hasVerifiedEmail": "..."
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**400**: Invalid or expired code

---

### Resend verification code

**Endpoint:** `POST /api/auth/resend-verification`

#### Request Body

Content-Type: `application/json`

```json
{
  "userId": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| userId | string | User ID |

#### Responses

**200**: New verification code sent

**429**: Rate limit exceeded

---

### User login

**Endpoint:** `POST /api/auth/login`

#### Request Body

Content-Type: `application/json`

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| email | string | - |
| password | string | - |

#### Responses

**200**: Successful login

```json
{
  "success": true,
  "message": "Login successful",
  "token": "string",
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "profilePicture": "string",
    "status": "string",
    "botEnabled": true,
    "botPersonality": "string",
    "isAdmin": true,
    "id": "string",
    "name": "string",
    "bio": "string",
    "blueTick": true,
    "goldenTick": true,
    "emailVerification": {
      "isVerified": "..."
    },
    "profileCompletion": {
      "completionPercentage": "...",
      "hasProfilePicture": "...",
      "hasBio": "...",
      "hasFollowers": "...",
      "hasVerifiedEmail": "..."
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**401**: Invalid credentials or unverified email

---

### Get profile completion status

**Endpoint:** `GET /api/auth/profile-completion`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: Profile completion status

```json
{
  "success": true,
  "profileCompletion": {
    "completionPercentage": 80,
    "hasProfilePicture": true,
    "hasBio": true,
    "hasFollowers": true,
    "hasVerifiedEmail": true,
    "blueTick": true,
    "nextSteps": [
      "string"
    ]
  }
}
```

---

### Request password reset for user

**Endpoint:** `POST /api/auth/forgot-password`

#### Request Body

Content-Type: `application/json`

```json
{
  "email": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| email | string | - |

#### Responses

**200**: Email sent successfully

**400**: Bad request (e.g. invalid email)

**404**: User not found

**500**: Internal server error

---

### Redirect to Google for OAuth login/signup

**Endpoint:** `GET /api/auth/google`

#### Responses

**302**: Redirects to Google OAuth consent screen

---

### Google OAuth callback. Issues JWT and redirects to frontend

**Endpoint:** `GET /api/auth/google/callback`

#### Responses

**302**: Redirects to success or failure URL after issuing JWT

**401**: OAuth failed

---

### Google OAuth for mobile apps (React Native)

**Endpoint:** `POST /api/auth/google/mobile`

#### Request Body

Content-Type: `application/json`

```json
{
  "idToken": "string",
  "user": {
    "name": "string",
    "email": "string",
    "photo": "string"
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| idToken | string | Google ID token from mobile SDK |
| user | object | - |

#### Responses

**200**: Successful authentication

```json
{
  "success": true,
  "message": "string",
  "token": "string",
  "deepLink": "aeko://(home)?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "profilePicture": "string",
    "status": "string",
    "botEnabled": true,
    "botPersonality": "string",
    "isAdmin": true,
    "id": "string",
    "name": "string",
    "bio": "string",
    "blueTick": true,
    "goldenTick": true,
    "emailVerification": {
      "isVerified": "..."
    },
    "profileCompletion": {
      "completionPercentage": "...",
      "hasProfilePicture": "...",
      "hasBio": "...",
      "hasFollowers": "...",
      "hasVerifiedEmail": "..."
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**400**: Bad request - missing ID token

**401**: Invalid ID token

---

### Register a new user

**Endpoint:** `POST /api/users/register`

#### Request Body

Content-Type: `application/json`

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| username | string | - |
| email | string | - |
| password | string | - |

#### Responses

**201**: User registered successfully

**400**: Bad request

**500**: Server error

---

### Login with email and password

**Endpoint:** `POST /api/users/login`

#### Request Body

Content-Type: `application/json`

```json
{
  "email": "string",
  "password": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| email | string | - |
| password | string | - |

#### Responses

**200**: Login successful

**401**: Invalid credentials

**500**: Server error

---

## Bot

### Enable/Disable Smart Bot

**Endpoint:** `PUT /api/bot-settings`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "botEnabled": true,
  "botPersonality": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| botEnabled | boolean | - |
| botPersonality | string | - |

#### Responses

**200**: Smart Bot settings updated successfully

**400**: Bad request

---

### Interact with the Smart Bot

**Endpoint:** `POST /api/chat`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "message": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| message | string | - |

#### Responses

**200**: Bot reply returned successfully

**400**: Bad request

**403**: Bot is disabled

---

### Update Smart Bot settings

**Endpoint:** `PUT /api/chat/bot-settings`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "botEnabled": true,
  "botPersonality": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| botEnabled | boolean | - |
| botPersonality | string | - |

#### Responses

**200**: Smart Bot settings updated successfully

**400**: Bad request

**401**: Unauthorized

---

## Chat

### Send a message

**Endpoint:** `POST /api/chat/send-message`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "recipientId": "string",
  "message": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| recipientId | string | - |
| message | string | - |

#### Responses

**200**: Message sent successfully

**400**: Bad request

**401**: Unauthorized

---

## Communities

### Update community profile

**Endpoint:** `PUT /api/communities/{id}/profile`

Update community profile information. Only community owner or moderators can update. Requires authentication and authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

Content-Type: `application/json`

```json
{
  "name": "string",
  "description": "string",
  "website": "string",
  "location": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| name | string | - |
| description | string | - |
| website | string | - |
| location | string | - |

#### Responses

**200**: Community profile updated successfully

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "profile": {
    "avatar": "string",
    "coverPhoto": "string",
    "website": "string",
    "location": "string"
  },
  "owner": "string",
  "moderators": [
    "string"
  ],
  "members": [
    {
      "user": "...",
      "joinedAt": "...",
      "role": "..."
    }
  ],
  "settings": {
    "isPrivate": true,
    "requireApproval": true,
    "canPost": true,
    "canComment": true,
    "payment": {
      "isPaidCommunity": "...",
      "price": "...",
      "currency": "...",
      "subscriptionType": "...",
      "paymentAddress": "..."
    },
    "postSettings": {
      "allowImages": "...",
      "allowVideos": "...",
      "allowLinks": "...",
      "requireApproval": "..."
    }
  },
  "memberCount": 0,
  "isActive": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Validation error

**401**: Unauthorized - authentication required

**403**: Not authorized to update this community

**404**: Community not found

---

### Upload community avatar or cover photo

**Endpoint:** `POST /api/communities/{id}/upload-photo`

Upload community photo. Only community owner or moderators can upload. Requires authentication and authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |
| type | query | string | Yes | Type of photo to upload |

#### Request Body

#### Responses

**200**: Photo uploaded successfully

```json
{
  "success": true,
  "data": {
    "avatar": "string",
    "coverPhoto": "string"
  }
}
```

**400**: No file uploaded or invalid file type

**401**: Unauthorized - authentication required

**403**: Not authorized to update this community

**404**: Community not found

---

### Update community settings

**Endpoint:** `PUT /api/communities/{id}/settings`

Update community settings including payment and post settings. Only community owner can update settings. Requires authentication and owner authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

Content-Type: `application/json`

```json
{
  "settings": {
    "payment": {
      "isPaidCommunity": true,
      "price": 0,
      "currency": "string",
      "subscriptionType": "string",
      "paymentAddress": "string"
    },
    "postSettings": {
      "allowImages": true,
      "allowVideos": true,
      "allowLinks": true,
      "requireApproval": true,
      "requireMembershipToPost": true
    },
    "isPrivate": true,
    "requireApproval": true,
    "canPost": true,
    "canComment": true
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| settings | object | - |

#### Responses

**200**: Community settings updated successfully

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "profile": {
    "avatar": "string",
    "coverPhoto": "string",
    "website": "string",
    "location": "string"
  },
  "owner": "string",
  "moderators": [
    "string"
  ],
  "members": [
    {
      "user": "...",
      "joinedAt": "...",
      "role": "..."
    }
  ],
  "settings": {
    "isPrivate": true,
    "requireApproval": true,
    "canPost": true,
    "canComment": true,
    "payment": {
      "isPaidCommunity": "...",
      "price": "...",
      "currency": "...",
      "subscriptionType": "...",
      "paymentAddress": "..."
    },
    "postSettings": {
      "allowImages": "...",
      "allowVideos": "...",
      "allowLinks": "...",
      "requireApproval": "..."
    }
  },
  "memberCount": 0,
  "isActive": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Validation error or invalid community ID

**401**: Unauthorized - authentication required

**403**: Only community owner can update settings

**404**: Community not found

---

### Follow a community (without joining chat)

**Endpoint:** `POST /api/communities/{id}/follow`

Follow a community without joining the chat. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Successfully followed the community

**400**: Already following this community or already a member

**401**: Unauthorized - authentication required

**404**: Community not found

---

### Unfollow a community

**Endpoint:** `POST /api/communities/{id}/unfollow`

Unfollow a community. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Successfully unfollowed the community

**400**: Not following or invalid request

**401**: Unauthorized - authentication required

**404**: Community not found

---

### Create a new community

**Endpoint:** `POST /api/communities`

Create a new community. Only users with golden tick can create communities. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "name": "string",
  "description": "string",
  "isPrivate": true,
  "tags": [
    "string"
  ]
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| name | string | Community name |
| description | string | Community description (minimum 10 characters) |
| isPrivate | boolean | Whether the community is private |
| tags | array | Community tags |

#### Responses

**201**: Community created successfully

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "profile": {
    "avatar": "string",
    "coverPhoto": "string",
    "website": "string",
    "location": "string"
  },
  "owner": "string",
  "moderators": [
    "string"
  ],
  "members": [
    {
      "user": "...",
      "joinedAt": "...",
      "role": "..."
    }
  ],
  "settings": {
    "isPrivate": true,
    "requireApproval": true,
    "canPost": true,
    "canComment": true,
    "payment": {
      "isPaidCommunity": "...",
      "price": "...",
      "currency": "...",
      "subscriptionType": "...",
      "paymentAddress": "..."
    },
    "postSettings": {
      "allowImages": "...",
      "allowVideos": "...",
      "allowLinks": "...",
      "requireApproval": "..."
    }
  },
  "memberCount": 0,
  "isActive": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Invalid input

**401**: Unauthorized - authentication required

**403**: User doesn't have permission to create a community

**500**: Server error

---

### Get all communities

**Endpoint:** `GET /api/communities`

Retrieve a list of all active communities with pagination and search

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number |
| limit | query | integer | No | Items per page |
| search | query | string | No | Search term for community name or description |

#### Responses

**200**: List of communities

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "...",
      "description": "...",
      "profile": "...",
      "owner": "...",
      "moderators": "...",
      "members": "...",
      "settings": "...",
      "memberCount": "...",
      "isActive": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "total": 0,
    "page": 0,
    "pages": 0,
    "limit": 0
  }
}
```

**500**: Server error

---

### Get community by ID

**Endpoint:** `GET /api/communities/{id}`

Retrieve detailed information about a specific community. Private communities require membership. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Community details

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "profile": {
    "avatar": "string",
    "coverPhoto": "string",
    "website": "string",
    "location": "string"
  },
  "owner": "string",
  "moderators": [
    "string"
  ],
  "members": [
    {
      "user": "...",
      "joinedAt": "...",
      "role": "..."
    }
  ],
  "settings": {
    "isPrivate": true,
    "requireApproval": true,
    "canPost": true,
    "canComment": true,
    "payment": {
      "isPaidCommunity": "...",
      "price": "...",
      "currency": "...",
      "subscriptionType": "...",
      "paymentAddress": "..."
    },
    "postSettings": {
      "allowImages": "...",
      "allowVideos": "...",
      "allowLinks": "...",
      "requireApproval": "..."
    }
  },
  "memberCount": 0,
  "isActive": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Invalid community ID format

**401**: Unauthorized - authentication required

**403**: Not authorized to view this community (if private)

**404**: Community not found

---

### Update community

**Endpoint:** `PUT /api/communities/{id}`

Update community details. Only community owner or moderators can update. Requires authentication and authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

Content-Type: `application/json`

```json
{
  "name": "string",
  "description": "string",
  "isPrivate": true,
  "tags": [
    "string"
  ],
  "settings": {}
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| name | string | - |
| description | string | - |
| isPrivate | boolean | - |
| tags | array | - |
| settings | object | - |

#### Responses

**200**: Community updated successfully

**400**: Validation error or invalid community ID

**401**: Unauthorized - authentication required

**403**: Forbidden - only owner or moderators can update

**404**: Community not found

---

### Delete a community

**Endpoint:** `DELETE /api/communities/{id}`

Delete a community permanently. Only community owner can delete. Requires authentication and owner authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Community deleted successfully

**400**: Invalid community ID format

**401**: Unauthorized - authentication required

**403**: Only the community owner can delete the community

**404**: Community not found

---

### Join a community

**Endpoint:** `POST /api/communities/{id}/join`

Join a community. For paid communities, payment is required first. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Successfully joined the community

```json
{
  "success": true,
  "message": "string",
  "requiresApproval": true
}
```

**400**: Already a member of this community

**401**: Unauthorized - authentication required

**402**: Payment required - this is a paid community

**403**: Community is private and requires approval

**404**: Community not found

---

### Leave a community

**Endpoint:** `POST /api/communities/{id}/leave`

Leave a community. Community owners cannot leave their own community. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

**200**: Successfully left the community

**400**: Not a member of this community

**401**: Unauthorized - authentication required

**403**: Community owner cannot leave (must transfer ownership first)

**404**: Community not found

---

## Community Payments

### Initialize community payment

**Endpoint:** `POST /api/community/payment/initialize`

Initialize payment for joining a paid community. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "communityId": "string",
  "paymentMethod": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| communityId | string | ID of the community to join |
| paymentMethod | string | Payment method to use |

#### Responses

**200**: Payment initialized successfully

```json
{
  "success": true,
  "authorizationUrl": "string",
  "reference": "string"
}
```

**400**: Invalid request or payment method not configured

**401**: Unauthorized - authentication required

**404**: Community or user not found

---

### Verify community payment

**Endpoint:** `GET /api/community/payment/verify`

Verify payment status and grant community membership if successful. No authentication required as this is called from payment provider callback.

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| reference | query | string | Yes | Payment reference from initialization |
| paymentMethod | query | string | Yes | Payment method used |

#### Responses

**200**: Payment verified successfully and membership granted

```json
{
  "success": true,
  "message": "string",
  "data": {}
}
```

**400**: Payment verification failed or invalid reference

**404**: Transaction not found

---

### Request withdrawal of community earnings

**Endpoint:** `POST /api/community/withdraw`

Request withdrawal of available community earnings. Only community owner can withdraw. Requires authentication and owner authorization.

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "communityId": "string",
  "amount": 0,
  "method": "string",
  "details": {
    "accountNumber": "string",
    "bankCode": "string",
    "accountName": "string"
  }
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| communityId | string | ID of the community |
| amount | number | Amount to withdraw (must not exceed available balance) |
| method | string | Withdrawal method |
| details | object | Withdrawal details (required for bank transfers) |

#### Responses

**200**: Withdrawal request submitted successfully

```json
{
  "success": true,
  "message": "string"
}
```

**400**: Invalid request, insufficient balance, or invalid community ID

**401**: Unauthorized - authentication required

**403**: Forbidden - only community owner can withdraw

**404**: Community not found

---

### Get community transaction history with filtering and statistics

**Endpoint:** `GET /api/community/{communityId}/transactions`

Retrieve transaction history for a community with pagination and filtering. Only community owner can view transactions. Requires authentication and owner authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| communityId | path | string | Yes | Community ID |
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of transactions per page (max 100) |
| status | query | string | No | Filter by transaction status |
| startDate | query | string | No | Filter transactions from this date (ISO 8601 format, e.g., 2024-01-01) |
| endDate | query | string | No | Filter transactions until this date (ISO 8601 format, e.g., 2024-12-31) |

#### Responses

**200**: Returns list of transactions with summary statistics

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "...",
        "user": "...",
        "amount": "...",
        "status": "...",
        "paymentMethod": "...",
        "createdAt": "..."
      }
    ],
    "summary": {
      "totalEarnings": 0,
      "pending": {},
      "completed": {},
      "failed": {}
    },
    "pagination": {
      "currentPage": 0,
      "totalPages": 0,
      "totalTransactions": 0
    }
  }
}
```

**400**: Invalid request parameters or community ID format

**401**: Unauthorized - authentication required

**403**: Forbidden - only community owner can view transactions

**404**: Community not found

**500**: Server error

---

## Community Posts

### Create a post in community

**Endpoint:** `POST /api/communities/{id}/posts`

Create a post in a community. Requires active membership. For paid communities, requires active subscription. Requires authentication and membership authorization.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

#### Responses

**201**: Post created successfully

```json
{
  "_id": "string",
  "content": "string",
  "author": {
    "_id": "...",
    "username": "...",
    "email": "...",
    "profilePicture": "...",
    "status": "...",
    "botEnabled": "...",
    "botPersonality": "...",
    "isAdmin": "...",
    "id": "...",
    "name": "...",
    "bio": "...",
    "blueTick": "...",
    "goldenTick": "...",
    "emailVerification": "...",
    "profileCompletion": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "community": {
    "_id": "...",
    "name": "...",
    "description": "...",
    "profile": "...",
    "owner": "...",
    "moderators": "...",
    "members": "...",
    "settings": "...",
    "memberCount": "...",
    "isActive": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "media": [
    {
      "url": "...",
      "type": "..."
    }
  ],
  "likes": [
    "string"
  ],
  "comments": [
    "string"
  ],
  "shares": 0,
  "status": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Validation error or invalid community ID

**401**: Unauthorized - authentication required

**403**: Not authorized to post in this community

**404**: Community not found

---

### Get community posts

**Endpoint:** `GET /api/communities/{id}/posts`

Retrieve posts from a community. Private communities require membership. Paid communities require active subscription. Requires authentication.

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |
| page | query | integer | No | Page number |
| limit | query | integer | No | Items per page |

#### Responses

**200**: List of community posts

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "content": "...",
      "author": "...",
      "community": "...",
      "media": "...",
      "likes": "...",
      "comments": "...",
      "shares": "...",
      "status": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "total": 0,
    "page": 0,
    "pages": 0,
    "limit": 0
  }
}
```

**400**: Invalid community ID format

**401**: Unauthorized - authentication required

**403**: Not authorized to view posts in this community

**404**: Community not found

---

## Emoji System

### Add emoji reaction to message

**Endpoint:** `POST /api/enhanced-chat/emoji-reactions/{messageId}`

Add emoji reaction to a specific message with real-time synchronization

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "emoji": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| emoji | string | - |

#### Responses

**200**: Reaction added successfully

---

### Get popular emojis list

**Endpoint:** `GET /api/enhanced-chat/emoji-list`

Retrieve categorized list of popular emojis for chat interface

#### Responses

**200**: Emoji list retrieved successfully

---

## Enhanced Bot

### Chat with Enhanced AI Bot

**Endpoint:** `POST /api/enhanced-bot/chat`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "message": "string",
  "instruction": "string",
  "personalityOverride": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| message | string | - |
| instruction | string | - |
| personalityOverride | string | - |

#### Responses

**200**: Bot response generated successfully

**403**: Bot is disabled

---

### Get user's bot settings

**Endpoint:** `GET /api/enhanced-bot/settings`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: Bot settings retrieved successfully

---

### Update bot settings

**Endpoint:** `PUT /api/enhanced-bot/settings`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "botEnabled": true,
  "botPersonality": "string",
  "aiProvider": "string",
  "model": "string",
  "maxTokens": 0,
  "contextLength": 0,
  "temperature": 0
}
```

#### Responses

**200**: Settings updated successfully

---

### Get available bot personalities

**Endpoint:** `GET /api/enhanced-bot/personalities`

#### Responses

**200**: Available personalities retrieved successfully

---

### Get conversation history

**Endpoint:** `GET /api/enhanced-bot/conversation-history`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| limit | query | number | No | Number of conversations to retrieve |
| page | query | number | No | Page number |

#### Responses

**200**: Conversation history retrieved successfully

---

### Get bot usage analytics

**Endpoint:** `GET /api/enhanced-bot/analytics`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: Analytics retrieved successfully

---

### Generate image using AI

**Endpoint:** `POST /api/enhanced-bot/generate-image`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "prompt": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| prompt | string | - |

#### Responses

**200**: Image generated successfully

**403**: Image generation not available

---

### Summarize conversation history

**Endpoint:** `POST /api/enhanced-bot/summarize-conversation`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "days": 0
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| days | number | - |

#### Responses

**200**: Conversation summarized successfully

---

### Rate bot response

**Endpoint:** `POST /api/enhanced-bot/rate-response`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "conversationId": "string",
  "rating": 0,
  "feedback": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| conversationId | string | - |
| rating | number | - |
| feedback | string | - |

#### Responses

**200**: Response rated successfully

---

## Enhanced Chat

### Get enhanced chat system information

**Endpoint:** `GET /api/chat-info`

Retrieve detailed information about the enhanced chat system capabilities and statistics

#### Responses

**200**: Chat system information

```json
null
```

---

### WebSocket (Socket.IO) API Documentation

**Endpoint:** `GET /websocket`


Connect to the WebSocket server for real-time features (chat, video/voice calls, notifications, etc.).

**WebSocket URL:**
- ws://localhost:5000 (Socket.IO)

**Authentication:**
- Pass JWT token as a query parameter or in the connection payload:
  - Example: io('ws://localhost:5000', { query: { token: '<JWT>' } })

**Key Events:**
- **Chat:**
  - send-message: { chatId, content }
  - receive-message: { chatId, sender, content, timestamp }
- **Video/Voice Calls:**
  - call-offer: { target, offer }
  - call-answer: { target, answer }
  - ice-candidate: { target, candidate }
- **Presence:**
  - user-online: { userId }
  - user-offline: { userId }

**Example Connection (JS):**
```js
const socket = io('ws://localhost:5000', { query: { token: '<JWT>' } });
socket.on('receive-message', (msg) => { ... });
socket.emit('send-message', { chatId, content });
```


**See /api-docs for full event and payload details.**
                

#### Responses

**200**: WebSocket documentation page (Markdown)

---

### Get user's conversations

**Endpoint:** `GET /api/enhanced-chat/conversations`

Retrieve paginated list of user's conversations with unread message counts and last message preview

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | - |
| limit | query | integer | No | - |

#### Responses

**200**: Conversations retrieved successfully

**401**: Unauthorized

---

### Get messages for a chat

**Endpoint:** `GET /api/enhanced-chat/messages/{chatId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| chatId | path | string | Yes | - |
| page | query | integer | No | - |
| limit | query | integer | No | - |
| before | query | string | No | Message ID to load messages before |

#### Responses

**200**: Messages retrieved successfully

---

### Send a text message

**Endpoint:** `POST /api/enhanced-chat/send-message`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "receiverId": "string",
  "chatId": "string",
  "content": "string",
  "messageType": "string",
  "replyToId": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| receiverId | string | - |
| chatId | string | - |
| content | string | - |
| messageType | string | - |
| replyToId | string | - |

#### Responses

**200**: Message sent successfully

---

### Upload a voice message

**Endpoint:** `POST /api/enhanced-chat/upload-voice`

Upload recorded voice message with waveform data and automatic duration detection

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| voice | formData | string | Yes | - |
| receiverId | formData | string | Yes | - |
| chatId | formData | string | Yes | - |
| duration | formData | string | Yes | - |

#### Responses

**200**: Voice message uploaded successfully

---

### Upload a file/image/video

**Endpoint:** `POST /api/enhanced-chat/upload-file`

Upload files up to 100MB with automatic type detection and thumbnail generation

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: File uploaded successfully

---

### Add emoji reaction to message

**Endpoint:** `POST /api/enhanced-chat/emoji-reactions/{messageId}`

Add emoji reaction to a specific message with real-time synchronization

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "emoji": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| emoji | string | - |

#### Responses

**200**: Reaction added successfully

---

### Remove emoji reaction from message

**Endpoint:** `DELETE /api/enhanced-chat/emoji-reactions/{messageId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes | - |
| emoji | query | string | Yes | - |

#### Responses

**200**: Reaction removed successfully

---

### Chat with AI bot

**Endpoint:** `POST /api/enhanced-chat/bot-chat`

Send message to AI bot with customizable personality and get intelligent response

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "message": "string",
  "chatId": "string",
  "personality": "string",
  "instruction": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| message | string | - |
| chatId | string | - |
| personality | string | - |
| instruction | string | - |

#### Responses

**200**: Bot response generated successfully

---

### Create a new chat

**Endpoint:** `POST /api/enhanced-chat/create-chat`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "participants": [
    "string"
  ],
  "isGroup": true,
  "groupName": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| participants | array | - |
| isGroup | boolean | - |
| groupName | string | - |

#### Responses

**200**: Chat created successfully

---

### Mark all messages in chat as read

**Endpoint:** `POST /api/enhanced-chat/mark-read/{chatId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| chatId | path | string | Yes | - |

#### Responses

**200**: Messages marked as read successfully

---

### Search messages

**Endpoint:** `GET /api/enhanced-chat/search`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| q | query | string | Yes | - |
| chatId | query | string | No | - |
| messageType | query | string | No | - |
| limit | query | integer | No | - |

#### Responses

**200**: Search results

---

### Get popular emojis list

**Endpoint:** `GET /api/enhanced-chat/emoji-list`

Retrieve categorized list of popular emojis for chat interface

#### Responses

**200**: Emoji list retrieved successfully

---

## Explore

### Get explore feed with trending content, suggested users, and communities

**Endpoint:** `GET /api/explore`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of posts per page |

#### Responses

**200**: Explore feed retrieved successfully

**401**: Unauthorized

---

## File Upload

### Apply a filter to a photo

**Endpoint:** `POST /api/photo/edit`

Upload a photo and apply a filter (greyscale, blur, rotate). Returns the URL to the edited photo.

#### Request Body

#### Responses

**200**: Edited photo URL

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

**500**: Error editing photo

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

---

### Apply an effect to a video

**Endpoint:** `POST /api/video/edit`

Upload a video and apply an effect (grayscale, negate, blur). Returns the URL to the edited video.

#### Request Body

#### Responses

**200**: Edited video URL

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

**500**: Error editing video

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

---

### Upload a file/image/video

**Endpoint:** `POST /api/enhanced-chat/upload-file`

Upload files up to 100MB with automatic type detection and thumbnail generation

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: File uploaded successfully

---

## Interests

### Create a new interest (Admin only)

**Endpoint:** `POST /api/interests`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "name": "string",
  "displayName": "string",
  "description": "string",
  "icon": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| name | string | - |
| displayName | string | - |
| description | string | - |
| icon | string | - |

#### Responses

**201**: Interest created successfully

**400**: Bad request

**401**: Unauthorized

**409**: Interest already exists

---

### Get all active interests

**Endpoint:** `GET /api/interests`

#### Responses

**200**: List of active interests

```json
[
  {}
]
```

---

### Update an interest (Admin only)

**Endpoint:** `PUT /api/interests/{id}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "displayName": "string",
  "description": "string",
  "icon": "string",
  "isActive": true
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| displayName | string | - |
| description | string | - |
| icon | string | - |
| isActive | boolean | - |

#### Responses

**200**: Interest updated successfully

**404**: Interest not found

---

### Delete an interest (Admin only)

**Endpoint:** `DELETE /api/interests/{id}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | - |

#### Responses

**200**: Interest deleted successfully

**404**: Interest not found

---

## Payments

### Initiate a payment

**Endpoint:** `POST /api/payments/pay`

Initiates a payment and returns a payment link

#### Request Body

Content-Type: `application/json`

```json
{
  "amount": 0,
  "currency": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| amount | number | Amount to be paid |
| currency | string | Currency for the payment |

#### Responses

**200**: Payment link generated successfully

```json
{
  "link": "string"
}
```

**400**: Bad request

---

### Verify a payment

**Endpoint:** `GET /api/payments/verify`

Verifies the payment status using the payment ID

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| paymentId | query | string | Yes | ID of the payment to verify |

#### Responses

**200**: Payment verified successfully

```json
{
  "status": "string",
  "amount": 0,
  "currency": "string"
}
```

**400**: Bad request

---

## Photo Effects

### Apply a filter to a photo

**Endpoint:** `POST /api/photo/edit`

Upload a photo and apply a filter (greyscale, blur, rotate). Returns the URL to the edited photo.

#### Request Body

#### Responses

**200**: Edited photo URL

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

**500**: Error editing photo

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

---

## Post Transfer

### Transfer a post to another user

**Endpoint:** `POST /api/posts/transfer`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "postId": "string",
  "toUserId": "string",
  "reason": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| postId | string | ID of the post to transfer |
| toUserId | string | ID of the user to transfer to |
| reason | string | Optional reason for transfer |

#### Responses

**200**: Post transferred successfully

**400**: Invalid request

**403**: Not authorized to transfer this post

**404**: Post or user not found

---

### Get transfer history of a post

**Endpoint:** `GET /api/posts/transfer-history/{postId}`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| postId | path | string | Yes | Post ID |

#### Responses

**200**: Transfer history retrieved successfully

**404**: Post not found

---

## Profile

### Get profile completion status

**Endpoint:** `GET /api/auth/profile-completion`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: Profile completion status

```json
{
  "success": true,
  "profileCompletion": {
    "completionPercentage": 80,
    "hasProfilePicture": true,
    "hasBio": true,
    "hasFollowers": true,
    "hasVerifiedEmail": true,
    "blueTick": true,
    "nextSteps": [
      "string"
    ]
  }
}
```

---

### Get user profile

**Endpoint:** `GET /api/profile`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: User profile retrieved successfully

**401**: Unauthorized

**403**: Forbidden

**500**: Server error

---

### Update user profile

**Endpoint:** `PUT /api/profile/update`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "username": "string",
  "email": "string",
  "profilePic": "string",
  "bio": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| username | string | - |
| email | string | - |
| profilePic | string | - |
| bio | string | - |

#### Responses

**200**: User profile updated successfully

```json
{
  "success": true,
  "user": {
    "_id": "string",
    "username": "string",
    "email": "string",
    "profilePicture": "string",
    "status": "string",
    "botEnabled": true,
    "botPersonality": "string",
    "isAdmin": true,
    "id": "string",
    "name": "string",
    "bio": "string",
    "blueTick": true,
    "goldenTick": true,
    "emailVerification": {
      "isVerified": "..."
    },
    "profileCompletion": {
      "completionPercentage": "...",
      "hasProfilePicture": "...",
      "hasBio": "...",
      "hasFollowers": "...",
      "hasVerifiedEmail": "..."
    },
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**400**: Bad request

**401**: Unauthorized

---

### Change user password

**Endpoint:** `PUT /api/profile/change-password`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| currentPassword | string | - |
| newPassword | string | - |

#### Responses

**200**: Password changed successfully

**400**: Bad request

**401**: Unauthorized

---

### Delete user account

**Endpoint:** `DELETE /api/profile/delete-account`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: User account deleted successfully

**401**: Unauthorized

---

### Get list of followers

**Endpoint:** `GET /api/profile/followers`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: List of followers retrieved successfully

---

### Get list of users the current user is following

**Endpoint:** `GET /api/profile/following`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: List of following users retrieved successfully

---

### Follow a user

**Endpoint:** `PUT /api/profile/follow/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | - |

#### Responses

**200**: Successfully followed the user

---

### Unfollow a user

**Endpoint:** `DELETE /api/profile/unfollow/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | - |

#### Responses

**200**: Successfully unfollowed the user

---

### Upload or update profile picture

**Endpoint:** `PUT /api/users/profile-picture`

**Security:** [{"bearerAuth":[]}]

#### Request Body

#### Responses

**200**: Profile picture updated successfully

```json
{
  "_id": "string",
  "username": "string",
  "email": "string",
  "profilePicture": "string",
  "status": "string",
  "botEnabled": true,
  "botPersonality": "string",
  "isAdmin": true,
  "id": "string",
  "name": "string",
  "bio": "string",
  "blueTick": true,
  "goldenTick": true,
  "emailVerification": {
    "isVerified": true
  },
  "profileCompletion": {
    "completionPercentage": 0,
    "hasProfilePicture": true,
    "hasBio": true,
    "hasFollowers": true,
    "hasVerifiedEmail": true
  },
  "createdAt": "string",
  "updatedAt": "string"
}
```

**400**: Bad request

**401**: Unauthorized

**500**: Server error

---

## Security

### Block a user

**Endpoint:** `POST /api/security/block/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to block |

#### Request Body

Content-Type: `application/json`

```json
{
  "reason": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| reason | string | Optional reason for blocking |

#### Responses

**200**: User blocked successfully

```json
{
  "success": true,
  "message": "string",
  "blockedUser": {}
}
```

**400**: Bad request (cannot block yourself, user already blocked)

**404**: User not found

**500**: Server error

---

### Unblock a user

**Endpoint:** `DELETE /api/security/block/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to unblock |

#### Responses

**200**: User unblocked successfully

```json
{
  "success": true,
  "message": "string"
}
```

**400**: User is not blocked

**404**: User not found

**500**: Server error

---

### Get list of blocked users

**Endpoint:** `GET /api/security/blocked`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |

#### Responses

**200**: List of blocked users retrieved successfully

```json
{
  "blockedUsers": [
    {
      "id": "string",
      "username": "string",
      "profilePicture": "string",
      "blockedAt": "string",
      "reason": "string"
    }
  ],
  "pagination": {
    "currentPage": 0,
    "totalPages": 0,
    "totalCount": 0,
    "hasNext": true,
    "hasPrev": true
  }
}
```

**404**: User not found

**500**: Server error

---

### Check if a user is blocked

**Endpoint:** `GET /api/security/block-status/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to check block status for |

#### Responses

**200**: Block status retrieved successfully

```json
{
  "isBlocked": true,
  "isBlockedBy": true,
  "canInteract": true
}
```

**500**: Server error

---

### Update privacy settings

**Endpoint:** `PUT /api/security/privacy`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "isPrivate": true,
  "allowFollowRequests": true,
  "showOnlineStatus": true,
  "allowDirectMessages": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| isPrivate | boolean | Make account private |
| allowFollowRequests | boolean | Allow follow requests for private accounts |
| showOnlineStatus | boolean | Show online status to others |
| allowDirectMessages | string | Who can send direct messages |

#### Responses

**200**: Privacy settings updated successfully

```json
{
  "success": true,
  "message": "string",
  "privacy": {}
}
```

**400**: Invalid privacy settings

**500**: Server error

---

### Get current privacy settings

**Endpoint:** `GET /api/security/privacy`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: Privacy settings retrieved successfully

```json
{
  "privacy": {
    "isPrivate": true,
    "allowFollowRequests": true,
    "showOnlineStatus": true,
    "allowDirectMessages": "string"
  }
}
```

**404**: User not found

**500**: Server error

---

### Send a follow request

**Endpoint:** `POST /api/security/follow-request/{userId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to send follow request to |

#### Responses

**200**: Follow request sent successfully

```json
{
  "success": true,
  "message": "string",
  "type": "string"
}
```

**400**: Bad request (already following, request already sent, etc.)

**404**: User not found

**500**: Server error

---

### Handle a follow request (approve or reject)

**Endpoint:** `PUT /api/security/follow-request/{requesterId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| requesterId | path | string | Yes | ID of the user who sent the follow request |

#### Request Body

Content-Type: `application/json`

```json
{
  "action": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| action | string | Action to take on the follow request |

#### Responses

**200**: Follow request handled successfully

```json
{
  "success": true,
  "message": "string",
  "action": "string"
}
```

**400**: Invalid action or request not found

**404**: User not found

**500**: Server error

---

### Get follow requests

**Endpoint:** `GET /api/security/follow-requests`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | Filter by request status |
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |

#### Responses

**200**: Follow requests retrieved successfully

```json
{
  "requests": [
    {
      "user": {
        "_id": "...",
        "username": "...",
        "name": "...",
        "profilePicture": "..."
      },
      "requestedAt": "string",
      "status": "string"
    }
  ],
  "pagination": {
    "currentPage": 0,
    "totalPages": 0,
    "totalRequests": 0,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

**404**: User not found

**500**: Server error

---

### Initialize 2FA setup

**Endpoint:** `POST /api/security/2fa/setup`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: 2FA setup initialized successfully

```json
{
  "success": true,
  "secret": "string",
  "qrCode": "string",
  "manualEntryKey": "string"
}
```

**400**: 2FA already enabled

**500**: Server error

---

### Complete 2FA setup with verification

**Endpoint:** `POST /api/security/2fa/verify-setup`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "secret": "string",
  "token": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| secret | string | The secret key from setup |
| token | string | 6-digit TOTP token from authenticator app |

#### Responses

**200**: 2FA enabled successfully

```json
{
  "success": true,
  "message": "string",
  "backupCodes": [
    "string"
  ]
}
```

**400**: Invalid token or 2FA already enabled

**500**: Server error

---

### Verify 2FA token during login

**Endpoint:** `POST /api/security/2fa/verify`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "token": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| token | string | 6-digit TOTP token from authenticator app |

#### Responses

**200**: 2FA verification successful

```json
{
  "success": true,
  "message": "string",
  "verified": true
}
```

**400**: Invalid token or 2FA not enabled

**500**: Server error

---

### Disable 2FA

**Endpoint:** `DELETE /api/security/2fa`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "password": "string",
  "token": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| password | string | Current account password |
| token | string | 6-digit TOTP token from authenticator app |

#### Responses

**200**: 2FA disabled successfully

```json
{
  "success": true,
  "message": "string"
}
```

**400**: Invalid password/token or 2FA not enabled

**500**: Server error

---

### Generate new backup codes

**Endpoint:** `POST /api/security/2fa/backup-codes`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "token": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| token | string | 6-digit TOTP token from authenticator app |

#### Responses

**200**: Backup codes generated successfully

```json
{
  "success": true,
  "message": "string",
  "backupCodes": [
    "string"
  ]
}
```

**400**: Invalid token or 2FA not enabled

**500**: Server error

---

### Verify backup code for emergency access

**Endpoint:** `POST /api/security/2fa/backup-verify`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "code": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| code | string | 8-character backup code |

#### Responses

**200**: Backup code verification result

```json
{
  "success": true,
  "message": "string",
  "verified": true
}
```

**400**: Invalid backup code or 2FA not enabled

**500**: Server error

---

### Get 2FA status

**Endpoint:** `GET /api/security/2fa/status`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: 2FA status retrieved successfully

```json
{
  "isEnabled": true,
  "enabledAt": "string",
  "lastUsed": "string",
  "backupCodesCount": 0
}
```

**500**: Server error

---

### Get user's security events

**Endpoint:** `GET /api/security/events`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| eventType | query | string | No | Filter by event type |
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |
| startDate | query | string | No | Start date for filtering events |
| endDate | query | string | No | End date for filtering events |

#### Responses

**200**: Security events retrieved successfully

```json
{
  "events": [
    {
      "_id": "string",
      "eventType": "string",
      "targetUser": {},
      "metadata": {},
      "timestamp": "string",
      "success": true
    }
  ],
  "pagination": {
    "page": 0,
    "limit": 0,
    "total": 0,
    "pages": 0
  }
}
```

**500**: Server error

---

### Get user's security statistics

**Endpoint:** `GET /api/security/stats`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| days | query | integer | No | Number of days to look back for statistics |

#### Responses

**200**: Security statistics retrieved successfully

```json
[
  {
    "_id": "string",
    "count": 0,
    "lastOccurrence": "string"
  }
]
```

**500**: Server error

---

## Spaces

### Create a Live Audio Space

**Endpoint:** `POST /api/spaces/create`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "title": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| title | string | Title of the space |

#### Responses

**200**: Space created successfully

```json
{
  "success": true,
  "space": {}
}
```

**400**: Bad request

---

### End a Live Audio Space

**Endpoint:** `PATCH /api/spaces/{spaceId}/end`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| spaceId | path | string | Yes | Space ID |

#### Responses

**200**: Space ended successfully

**403**: Only host can end space

**404**: Space not found

---

### Add a video highlight to a space

**Endpoint:** `PUT /api/spaces/{spaceId}/highlight`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| spaceId | path | string | Yes | Space ID |

#### Request Body

Content-Type: `application/json`

```json
{
  "videoUrl": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| videoUrl | string | URL of the highlight video |

#### Responses

**200**: Highlight added successfully

**404**: Space not found

---

## Status

### Create a new status (image, text, or video)

**Endpoint:** `POST /api/status`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "type": "string",
  "content": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| type | string | - |
| content | string | - |

#### Responses

**201**: Status created successfully

**400**: Bad request

---

### Get active statuses from followers

**Endpoint:** `GET /api/status`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: List of active statuses

```json
{
  "success": true,
  "statuses": [
    {
      "_id": "string",
      "userId": {},
      "type": "string",
      "content": "string",
      "sharedPostData": {
        "originalPost": "...",
        "shareInfo": "..."
      }
    }
  ]
}
```

---

### Delete a status

**Endpoint:** `DELETE /api/status/{id}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | - |

#### Responses

**200**: Status deleted successfully

---

### React to a status

**Endpoint:** `POST /api/status/{id}/react`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | - |

#### Request Body

Content-Type: `application/json`

```json
{
  "emoji": "string"
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| emoji | string | - |

#### Responses

**200**: Reaction added successfully

---

## Subscription

### Subscribe to Golden Tick

**Endpoint:** `POST /api/subscription/subscribe`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "userId": "string",
  "paymentSuccess": true
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| userId | string | Unique identifier of the user |
| paymentSuccess | boolean | Status of payment transaction |

#### Responses

**200**: Golden Tick activated successfully

**400**: Bad request, invalid input

**401**: Unauthorized, authentication required

**500**: Internal server error

---

## System

### System health check

**Endpoint:** `GET /health`

Get system health status and feature availability

#### Responses

**200**: System health information

```json
{
  "status": "OK",
  "timestamp": "string",
  "services": {
    "mongodb": "Connected",
    "socket": "Active",
    "chat": "Enhanced Chat System Ready",
    "ai": "AI Bot Integrated"
  },
  "features": [
    "string"
  ]
}
```

---

### Get enhanced chat system information

**Endpoint:** `GET /api/chat-info`

Retrieve detailed information about the enhanced chat system capabilities and statistics

#### Responses

**200**: Chat system information

```json
null
```

---

### WebSocket (Socket.IO) API Documentation

**Endpoint:** `GET /websocket`


Connect to the WebSocket server for real-time features (chat, video/voice calls, notifications, etc.).

**WebSocket URL:**
- ws://localhost:5000 (Socket.IO)

**Authentication:**
- Pass JWT token as a query parameter or in the connection payload:
  - Example: io('ws://localhost:5000', { query: { token: '<JWT>' } })

**Key Events:**
- **Chat:**
  - send-message: { chatId, content }
  - receive-message: { chatId, sender, content, timestamp }
- **Video/Voice Calls:**
  - call-offer: { target, offer }
  - call-answer: { target, answer }
  - ice-candidate: { target, candidate }
- **Presence:**
  - user-online: { userId }
  - user-offline: { userId }

**Example Connection (JS):**
```js
const socket = io('ws://localhost:5000', { query: { token: '<JWT>' } });
socket.on('receive-message', (msg) => { ... });
socket.emit('send-message', { chatId, content });
```


**See /api-docs for full event and payload details.**
                

#### Responses

**200**: WebSocket documentation page (Markdown)

---

## User Interests

### Get user's interests

**Endpoint:** `GET /api/user/interests`

**Security:** [{"bearerAuth":[]}]

#### Responses

**200**: User's interests

```json
[
  {}
]
```

---

### Update user's interests

**Endpoint:** `POST /api/user/interests`

**Security:** [{"bearerAuth":[]}]

#### Request Body

Content-Type: `application/json`

```json
{
  "interestIds": [
    "string"
  ]
}
```

**Schema Properties:**

| Property | Type | Description |
|----------|------|-------------|
| interestIds | array | Array of interest IDs |

#### Responses

**200**: Interests updated successfully

**400**: Invalid interest IDs

---

### Remove an interest from user's interests

**Endpoint:** `DELETE /api/user/interests/{interestId}`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| interestId | path | string | Yes | - |

#### Responses

**200**: Interest removed successfully

**404**: Interest not found in user's interests

---

## Users

### Get user by ID

**Endpoint:** `GET /api/users/{id}`

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | - |

#### Responses

**200**: User retrieved

**404**: User not found

**500**: Server error

---

### Get all users

**Endpoint:** `GET /api/users`

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of users per page |
| search | query | string | No | Search users by name or username |

#### Responses

**200**: List of users retrieved successfully

```json
{
  "success": true,
  "users": [
    {
      "_id": "...",
      "username": "...",
      "email": "...",
      "profilePicture": "...",
      "status": "...",
      "botEnabled": "...",
      "botPersonality": "...",
      "isAdmin": "...",
      "id": "...",
      "name": "...",
      "bio": "...",
      "blueTick": "...",
      "goldenTick": "...",
      "emailVerification": "...",
      "profileCompletion": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "currentPage": 0,
    "totalPages": 0,
    "totalUsers": 0,
    "hasNext": true,
    "hasPrev": true
  }
}
```

**401**: Unauthorized

**500**: Server error

---

## Video Effects

### Apply an effect to a video

**Endpoint:** `POST /api/video/edit`

Upload a video and apply an effect (grayscale, negate, blur). Returns the URL to the edited video.

#### Request Body

#### Responses

**200**: Edited video URL

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

**500**: Error editing video

```json
{
  "success": true,
  "url": "string",
  "error": "string"
}
```

---

## Voice Messages

### Upload a voice message

**Endpoint:** `POST /api/enhanced-chat/upload-voice`

Upload recorded voice message with waveform data and automatic duration detection

**Security:** [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| voice | formData | string | Yes | - |
| receiverId | formData | string | Yes | - |
| chatId | formData | string | Yes | - |
| duration | formData | string | Yes | - |

#### Responses

**200**: Voice message uploaded successfully

---

## WebRTC Calls

### WebRTC signaling event (socket.io)

**Endpoint:** `POST /socket.io/webrtc-signaling`


                    Use socket.io to emit and listen for the following events for video/voice calls:
                    - call-offer: Send a WebRTC offer to another user
                    - call-answer: Send a WebRTC answer in response to an offer
                    - ice-candidate: Exchange ICE candidates for peer connection
                    


                    Example socket.io payloads:
                    - call-offer: { target: '<socketId>', offer: { ...SDP } }
                    - call-answer: { target: '<socketId>', answer: { ...SDP } }
                    - ice-candidate: { target: '<socketId>', candidate: { ...ICE } }
                

#### Request Body

Content-Type: `application/json`

```json
{
  "target": "string",
  "offer": {},
  "answer": {},
  "candidate": {}
}
```

#### Responses

**200**: Signal relayed successfully (socket.io emits to target)

```json
{
  "success": true
}
```

---

### WebSocket (Socket.IO) API Documentation

**Endpoint:** `GET /websocket`


Connect to the WebSocket server for real-time features (chat, video/voice calls, notifications, etc.).

**WebSocket URL:**
- ws://localhost:5000 (Socket.IO)

**Authentication:**
- Pass JWT token as a query parameter or in the connection payload:
  - Example: io('ws://localhost:5000', { query: { token: '<JWT>' } })

**Key Events:**
- **Chat:**
  - send-message: { chatId, content }
  - receive-message: { chatId, sender, content, timestamp }
- **Video/Voice Calls:**
  - call-offer: { target, offer }
  - call-answer: { target, answer }
  - ice-candidate: { target, candidate }
- **Presence:**
  - user-online: { userId }
  - user-offline: { userId }

**Example Connection (JS):**
```js
const socket = io('ws://localhost:5000', { query: { token: '<JWT>' } });
socket.on('receive-message', (msg) => { ... });
socket.emit('send-message', { chatId, content });
```


**See /api-docs for full event and payload details.**
                

#### Responses

**200**: WebSocket documentation page (Markdown)

---

