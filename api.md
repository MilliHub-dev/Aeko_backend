# Aeko Enhanced API


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
        

**Base URL**: `https://dev.aeko.social`
**Version**: 2.0.0

## AI Bot

### Chat with AI bot

`POST` **/api/enhanced-chat/bot-chat**

Send message to AI bot with customizable personality and get intelligent response

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    },
    "chatId": {
      "type": "string"
    },
    "personality": {
      "type": "string",
      "enum": [
        "friendly",
        "professional",
        "sarcastic",
        "creative",
        "analytical",
        "mentor",
        "companion"
      ]
    },
    "instruction": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Bot response generated successfully

---

## Admin

### Delete a user permanently

`DELETE` **/api/admin/users/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to delete |

#### Responses

- **200**: User deleted successfully
- **404**: User not found
- **500**: Server error

---

### Get advertisements for admin review

`GET` **/api/ads/admin/review**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No |  |
| page | query | integer | No |  |
| limit | query | integer | No |  |

#### Responses

- **200**: Ads for review retrieved successfully

---

### Review advertisement (admin only)

`POST` **/api/ads/admin/review/{adId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "status"
  ],
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "approved",
        "rejected"
      ]
    },
    "rejectionReason": {
      "type": "string"
    },
    "feedback": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Advertisement reviewed successfully

---

## Advertisements

### Create new advertisement

`POST` **/api/ads**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "title",
    "description",
    "mediaType",
    "budget",
    "pricing",
    "campaign"
  ],
  "properties": {
    "title": {
      "type": "string",
      "example": "Summer Sale - 50% Off"
    },
    "description": {
      "type": "string",
      "example": "Don't miss our biggest summer sale!"
    },
    "mediaType": {
      "type": "string",
      "enum": [
        "image",
        "video",
        "text",
        "carousel"
      ]
    },
    "mediaUrl": {
      "type": "string",
      "example": "https://example.com/ad-image.jpg"
    },
    "targetAudience": {
      "type": "object",
      "properties": {
        "age": {
          "type": "object",
          "properties": {
            "min": {
              "type": "number",
              "example": 18
            },
            "max": {
              "type": "number",
              "example": 45
            }
          }
        },
        "location": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "example": [
            "United States"
          ]
        },
        "interests": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "example": [
            "fashion",
            "shopping"
          ]
        }
      }
    },
    "budget": {
      "type": "object",
      "required": [
        "total"
      ],
      "properties": {
        "total": {
          "type": "number",
          "example": 1000
        },
        "daily": {
          "type": "number",
          "example": 50
        },
        "currency": {
          "type": "string",
          "enum": [
            "USD",
            "AEKO"
          ],
          "example": "USD"
        }
      }
    },
    "pricing": {
      "type": "object",
      "required": [
        "model",
        "bidAmount"
      ],
      "properties": {
        "model": {
          "type": "string",
          "enum": [
            "cpm",
            "cpc",
            "cpa"
          ]
        },
        "bidAmount": {
          "type": "number",
          "example": 2.5
        }
      }
    },
    "campaign": {
      "type": "object",
      "required": [
        "objective",
        "schedule"
      ],
      "properties": {
        "objective": {
          "type": "string",
          "enum": [
            "awareness",
            "traffic",
            "engagement",
            "conversions",
            "app_installs"
          ]
        },
        "schedule": {
          "type": "object",
          "required": [
            "startDate",
            "endDate"
          ],
          "properties": {
            "startDate": {
              "type": "string",
              "format": "date-time"
            },
            "endDate": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    },
    "callToAction": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "learn_more",
            "shop_now",
            "sign_up",
            "download",
            "contact_us",
            "visit_website"
          ]
        },
        "url": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      }
    }
  }
}
```

#### Responses

- **201**: Advertisement created successfully
- **400**: Bad request - validation errors
- **401**: Unauthorized

---

### Get user's advertisements

`GET` **/api/ads**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | Filter ads by status |
| page | query | integer | No | Page number |
| limit | query | integer | No | Number of ads per page |

#### Responses

- **200**: User advertisements retrieved successfully

---

### Get targeted advertisements for user

`GET` **/api/ads/targeted**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| limit | query | integer | No | Number of ads to return |

#### Responses

- **200**: Targeted ads retrieved successfully

---

### Track advertisement impression

`POST` **/api/ads/track/impression**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string",
      "description": "Advertisement ID"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "age": {
          "type": "number"
        },
        "location": {
          "type": "string"
        },
        "device": {
          "type": "string"
        }
      }
    }
  }
}
```

#### Responses

- **200**: Impression tracked successfully
- **400**: Bad request
- **404**: Advertisement not found

---

### Track advertisement click

`POST` **/api/ads/track/click**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string",
      "description": "Advertisement ID"
    },
    "metadata": {
      "type": "object"
    }
  }
}
```

#### Responses

- **200**: Click tracked successfully

---

### Track advertisement conversion

`POST` **/api/ads/track/conversion**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string"
    },
    "conversionValue": {
      "type": "number"
    },
    "conversionType": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Conversion tracked successfully

---

### Get advertisement analytics

`GET` **/api/ads/{adId}/analytics**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |
| timeRange | query | string | No |  |

#### Responses

- **200**: Analytics retrieved successfully

---

### Update advertisement

`PUT` **/api/ads/{adId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "draft",
        "pending",
        "running",
        "paused"
      ]
    },
    "budget": {
      "type": "object"
    }
  }
}
```

#### Responses

- **200**: Advertisement updated successfully

---

### Delete advertisement

`DELETE` **/api/ads/{adId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |

#### Responses

- **200**: Advertisement deleted successfully
- **400**: Cannot delete running advertisement

---

### Get advertisement dashboard

`GET` **/api/ads/dashboard**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| timeRange | query | string | No |  |

#### Responses

- **200**: Dashboard data retrieved successfully

---

### Get advertisements for admin review

`GET` **/api/ads/admin/review**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No |  |
| page | query | integer | No |  |
| limit | query | integer | No |  |

#### Responses

- **200**: Ads for review retrieved successfully

---

### Review advertisement (admin only)

`POST` **/api/ads/admin/review/{adId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "status"
  ],
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "approved",
        "rejected"
      ]
    },
    "rejectionReason": {
      "type": "string"
    },
    "feedback": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Advertisement reviewed successfully

---

## Analytics

### Track advertisement impression

`POST` **/api/ads/track/impression**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string",
      "description": "Advertisement ID"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "age": {
          "type": "number"
        },
        "location": {
          "type": "string"
        },
        "device": {
          "type": "string"
        }
      }
    }
  }
}
```

#### Responses

- **200**: Impression tracked successfully
- **400**: Bad request
- **404**: Advertisement not found

---

### Track advertisement click

`POST` **/api/ads/track/click**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string",
      "description": "Advertisement ID"
    },
    "metadata": {
      "type": "object"
    }
  }
}
```

#### Responses

- **200**: Click tracked successfully

---

### Track advertisement conversion

`POST` **/api/ads/track/conversion**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "adId"
  ],
  "properties": {
    "adId": {
      "type": "string"
    },
    "conversionValue": {
      "type": "number"
    },
    "conversionType": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Conversion tracked successfully

---

### Get advertisement analytics

`GET` **/api/ads/{adId}/analytics**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| adId | path | string | Yes |  |
| timeRange | query | string | No |  |

#### Responses

- **200**: Analytics retrieved successfully

---

### Get advertisement dashboard

`GET` **/api/ads/dashboard**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| timeRange | query | string | No |  |

#### Responses

- **200**: Dashboard data retrieved successfully

---

## Authentication

### User registration with email verification

`POST` **/api/auth/signup**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "name",
    "username",
    "email",
    "password"
  ],
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name",
      "example": "John Doe"
    },
    "username": {
      "type": "string",
      "description": "Unique username",
      "example": "johndoe"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "User's email address",
      "example": "john@example.com"
    },
    "password": {
      "type": "string",
      "minLength": 6,
      "description": "User's password",
      "example": "password123"
    }
  }
}
```

#### Responses

- **201**: User registered successfully, verification code sent
- **400**: Bad request - validation errors
- **409**: User already exists

---

### Verify email with 4-digit code

`POST` **/api/auth/verify-email**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "userId",
    "verificationCode"
  ],
  "properties": {
    "userId": {
      "type": "string",
      "description": "User ID from registration"
    },
    "verificationCode": {
      "type": "string",
      "pattern": "^[0-9]{4}$",
      "description": "4-digit verification code",
      "example": "1234"
    }
  }
}
```

#### Responses

- **200**: Email verified successfully
- **400**: Invalid or expired code

---

### Resend verification code

`POST` **/api/auth/resend-verification**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "userId"
  ],
  "properties": {
    "userId": {
      "type": "string",
      "description": "User ID"
    }
  }
}
```

#### Responses

- **200**: New verification code sent
- **429**: Rate limit exceeded

---

### User login

`POST` **/api/auth/login**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "email",
    "password"
  ],
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "example": "john@example.com"
    },
    "password": {
      "type": "string",
      "example": "password123"
    }
  }
}
```

#### Responses

- **200**: Successful login
- **401**: Invalid credentials or unverified email

---

### Get profile completion status

`GET` **/api/auth/profile-completion**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: Profile completion status

---

### Request password reset for user

`POST` **/api/auth/forgot-password**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  },
  "example": {
    "email": "john@example.com"
  }
}
```

#### Responses

- **200**: Email sent successfully
- **400**: Bad request (e.g. invalid email)
- **404**: User not found
- **500**: Internal server error

---

### Redirect to Google for OAuth login/signup

`GET` **/api/auth/google**

#### Responses

- **302**: Redirects to Google OAuth consent screen

---

### Google OAuth callback. Issues JWT and redirects to frontend

`GET` **/api/auth/google/callback**

#### Responses

- **302**: Redirects to success or failure URL after issuing JWT
- **401**: OAuth failed

---

### Google OAuth for mobile apps (React Native)

`POST` **/api/auth/google/mobile**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "idToken"
  ],
  "properties": {
    "idToken": {
      "type": "string",
      "description": "Google ID token from mobile SDK"
    },
    "user": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "email": {
          "type": "string"
        },
        "photo": {
          "type": "string"
        }
      }
    }
  }
}
```

#### Responses

- **200**: Successful authentication
- **400**: Bad request - missing ID token
- **401**: Invalid ID token

---

### Register a new user

`POST` **/api/users/register**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "username",
    "email",
    "password"
  ],
  "properties": {
    "username": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "password": {
      "type": "string",
      "minLength": 6
    }
  }
}
```

#### Responses

- **201**: User registered successfully
- **400**: Bad request
- **500**: Server error

---

### Login with email and password

`POST` **/api/users/login**

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "email",
    "password"
  ],
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    },
    "password": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Login successful
- **401**: Invalid credentials
- **500**: Server error

---

## Bot

### Enable/Disable Smart Bot

`PUT` **/api/bot-settings**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "botEnabled",
    "botPersonality"
  ],
  "properties": {
    "botEnabled": {
      "type": "boolean"
    },
    "botPersonality": {
      "type": "string",
      "enum": [
        "friendly",
        "professional",
        "sarcastic"
      ]
    }
  }
}
```

#### Responses

- **200**: Smart Bot settings updated successfully
- **400**: Bad request

---

### Interact with the Smart Bot

`POST` **/api/chat**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    }
  },
  "required": [
    "message"
  ]
}
```

#### Responses

- **200**: Bot reply returned successfully
- **400**: Bad request
- **403**: Bot is disabled

---

### Update Smart Bot settings

`PUT` **/api/chat/bot-settings**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "botEnabled",
    "botPersonality"
  ],
  "properties": {
    "botEnabled": {
      "type": "boolean"
    },
    "botPersonality": {
      "type": "string",
      "enum": [
        "friendly",
        "professional",
        "sarcastic"
      ]
    }
  }
}
```

#### Responses

- **200**: Smart Bot settings updated successfully
- **400**: Bad request
- **401**: Unauthorized

---

## Chat

### Send a message

`POST` **/api/chat/send-message**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "recipientId",
    "message"
  ],
  "properties": {
    "recipientId": {
      "type": "string"
    },
    "message": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Message sent successfully
- **400**: Bad request
- **401**: Unauthorized

---

## Communities

### Update community profile

`PUT` **/api/communities/{id}/profile**

Update community profile information. Only community owner or moderators can update. Requires authentication and authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 3,
      "maxLength": 50
    },
    "description": {
      "type": "string",
      "maxLength": 500
    },
    "website": {
      "type": "string",
      "format": "uri"
    },
    "location": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Community profile updated successfully
- **400**: Validation error
- **401**: Unauthorized - authentication required
- **403**: Not authorized to update this community
- **404**: Community not found

---

### Upload community avatar or cover photo

`POST` **/api/communities/{id}/upload-photo**

Upload community photo. Only community owner or moderators can upload. Requires authentication and authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |
| type | query | string | Yes | Type of photo to upload |

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "required": [
    "photo"
  ],
  "properties": {
    "photo": {
      "type": "string",
      "format": "binary"
    },
    "type": {
      "type": "string",
      "enum": [
        "avatar",
        "cover"
      ]
    }
  }
}
```

#### Responses

- **200**: Photo uploaded successfully
- **400**: No file uploaded or invalid file type
- **401**: Unauthorized - authentication required
- **403**: Not authorized to update this community
- **404**: Community not found

---

### Update community settings

`PUT` **/api/communities/{id}/settings**

Update community settings including payment and post settings. Only community owner can update settings. Requires authentication and owner authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "settings": {
      "type": "object",
      "properties": {
        "payment": {
          "type": "object",
          "properties": {
            "isPaidCommunity": {
              "type": "boolean"
            },
            "price": {
              "type": "number"
            },
            "currency": {
              "type": "string"
            },
            "subscriptionType": {
              "type": "string",
              "enum": [
                "one_time",
                "monthly",
                "yearly"
              ]
            },
            "paymentAddress": {
              "type": "string"
            }
          }
        },
        "postSettings": {
          "type": "object",
          "properties": {
            "allowImages": {
              "type": "boolean"
            },
            "allowVideos": {
              "type": "boolean"
            },
            "allowLinks": {
              "type": "boolean"
            },
            "requireApproval": {
              "type": "boolean"
            },
            "requireMembershipToPost": {
              "type": "boolean"
            }
          }
        },
        "isPrivate": {
          "type": "boolean"
        },
        "requireApproval": {
          "type": "boolean"
        },
        "canPost": {
          "type": "boolean"
        },
        "canComment": {
          "type": "boolean"
        }
      }
    }
  }
}
```

#### Responses

- **200**: Community settings updated successfully
- **400**: Validation error or invalid community ID
- **401**: Unauthorized - authentication required
- **403**: Only community owner can update settings
- **404**: Community not found

---

### Follow a community (without joining chat)

`POST` **/api/communities/{id}/follow**

Follow a community without joining the chat. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Successfully followed the community
- **400**: Already following this community or already a member
- **401**: Unauthorized - authentication required
- **404**: Community not found

---

### Unfollow a community

`POST` **/api/communities/{id}/unfollow**

Unfollow a community. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Successfully unfollowed the community
- **400**: Not following or invalid request
- **401**: Unauthorized - authentication required
- **404**: Community not found

---

### Create a new community

`POST` **/api/communities**

Create a new community. Only users with golden tick can create communities. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "name",
    "description"
  ],
  "properties": {
    "name": {
      "type": "string",
      "description": "Community name",
      "minLength": 3,
      "maxLength": 50
    },
    "description": {
      "type": "string",
      "minLength": 10,
      "description": "Community description (minimum 10 characters)",
      "maxLength": 500
    },
    "isPrivate": {
      "type": "boolean",
      "default": false,
      "description": "Whether the community is private"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Community tags"
    }
  }
}
```

#### Responses

- **201**: Community created successfully
- **400**: Invalid input
- **401**: Unauthorized - authentication required
- **403**: User doesn't have permission to create a community
- **500**: Server error

---

### Get all communities

`GET` **/api/communities**

Retrieve a list of all active communities with pagination and search

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number |
| limit | query | integer | No | Items per page |
| search | query | string | No | Search term for community name or description |

#### Responses

- **200**: List of communities
- **500**: Server error

---

### Get community by ID

`GET` **/api/communities/{id}**

Retrieve detailed information about a specific community. Private communities require membership. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Community details
- **400**: Invalid community ID format
- **401**: Unauthorized - authentication required
- **403**: Not authorized to view this community (if private)
- **404**: Community not found

---

### Update community

`PUT` **/api/communities/{id}**

Update community details. Only community owner or moderators can update. Requires authentication and authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string",
      "minLength": 10
    },
    "isPrivate": {
      "type": "boolean"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "settings": {
      "type": "object"
    }
  }
}
```

#### Responses

- **200**: Community updated successfully
- **400**: Validation error or invalid community ID
- **401**: Unauthorized - authentication required
- **403**: Forbidden - only owner or moderators can update
- **404**: Community not found

---

### Delete a community

`DELETE` **/api/communities/{id}**

Delete a community permanently. Only community owner can delete. Requires authentication and owner authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Community deleted successfully
- **400**: Invalid community ID format
- **401**: Unauthorized - authentication required
- **403**: Only the community owner can delete the community
- **404**: Community not found

---

### Join a community

`POST` **/api/communities/{id}/join**

Join a community. For paid communities, payment is required first. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Successfully joined the community
- **400**: Already a member of this community
- **401**: Unauthorized - authentication required
- **402**: Payment required - this is a paid community
- **403**: Community is private and requires approval
- **404**: Community not found

---

### Leave a community

`POST` **/api/communities/{id}/leave**

Leave a community. Community owners cannot leave their own community. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Responses

- **200**: Successfully left the community
- **400**: Not a member of this community
- **401**: Unauthorized - authentication required
- **403**: Community owner cannot leave (must transfer ownership first)
- **404**: Community not found

---

## Community Payments

### Initialize community payment

`POST` **/api/community/payment/initialize**

Initialize payment for joining a paid community. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "communityId",
    "paymentMethod"
  ],
  "properties": {
    "communityId": {
      "type": "string",
      "description": "ID of the community to join"
    },
    "paymentMethod": {
      "type": "string",
      "enum": [
        "paystack",
        "stripe"
      ],
      "description": "Payment method to use"
    }
  }
}
```

#### Responses

- **200**: Payment initialized successfully
- **400**: Invalid request or payment method not configured
- **401**: Unauthorized - authentication required
- **404**: Community or user not found

---

### Verify community payment

`GET` **/api/community/payment/verify**

Verify payment status and grant community membership if successful. No authentication required as this is called from payment provider callback.

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| reference | query | string | Yes | Payment reference from initialization |
| paymentMethod | query | string | Yes | Payment method used |

#### Responses

- **200**: Payment verified successfully and membership granted
- **400**: Payment verification failed or invalid reference
- **404**: Transaction not found

---

### Request withdrawal of community earnings

`POST` **/api/community/withdraw**

Request withdrawal of available community earnings. Only community owner can withdraw. Requires authentication and owner authorization.

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "communityId",
    "amount",
    "method",
    "details"
  ],
  "properties": {
    "communityId": {
      "type": "string",
      "description": "ID of the community"
    },
    "amount": {
      "type": "number",
      "description": "Amount to withdraw (must not exceed available balance)",
      "minimum": 0.01
    },
    "method": {
      "type": "string",
      "enum": [
        "bank"
      ],
      "description": "Withdrawal method"
    },
    "details": {
      "type": "object",
      "description": "Withdrawal details (required for bank transfers)",
      "properties": {
        "accountNumber": {
          "type": "string"
        },
        "bankCode": {
          "type": "string"
        },
        "accountName": {
          "type": "string"
        }
      }
    }
  }
}
```

#### Responses

- **200**: Withdrawal request submitted successfully
- **400**: Invalid request, insufficient balance, or invalid community ID
- **401**: Unauthorized - authentication required
- **403**: Forbidden - only community owner can withdraw
- **404**: Community not found

---

### Get community transaction history with filtering and statistics

`GET` **/api/community/{communityId}/transactions**

Retrieve transaction history for a community with pagination and filtering. Only community owner can view transactions. Requires authentication and owner authorization.

**Security**: [{"bearerAuth":[]}]

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

- **200**: Returns list of transactions with summary statistics
- **400**: Invalid request parameters or community ID format
- **401**: Unauthorized - authentication required
- **403**: Forbidden - only community owner can view transactions
- **404**: Community not found
- **500**: Server error

---

## Community Posts

### Create a post in community

`POST` **/api/communities/{id}/posts**

Create a post in a community. Requires active membership. For paid communities, requires active subscription. Requires authentication and membership authorization.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "Post content"
    },
    "media": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "binary"
      },
      "maxItems": 10,
      "description": "Media files (images, videos)"
    }
  }
}
```

#### Responses

- **201**: Post created successfully
- **400**: Validation error or invalid community ID
- **401**: Unauthorized - authentication required
- **403**: Not authorized to post in this community
- **404**: Community not found

---

### Get community posts

`GET` **/api/communities/{id}/posts**

Retrieve posts from a community. Private communities require membership. Paid communities require active subscription. Requires authentication.

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes | Community ID |
| page | query | integer | No | Page number |
| limit | query | integer | No | Items per page |

#### Responses

- **200**: List of community posts
- **400**: Invalid community ID format
- **401**: Unauthorized - authentication required
- **403**: Not authorized to view posts in this community
- **404**: Community not found

---

## Emoji System

### Add emoji reaction to message

`POST` **/api/enhanced-chat/emoji-reactions/{messageId}**

Add emoji reaction to a specific message with real-time synchronization

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "emoji": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Reaction added successfully

---

### Get popular emojis list

`GET` **/api/enhanced-chat/emoji-list**

Retrieve categorized list of popular emojis for chat interface

#### Responses

- **200**: Emoji list retrieved successfully

---

## Enhanced Bot

### Chat with Enhanced AI Bot

`POST` **/api/enhanced-bot/chat**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "message"
  ],
  "properties": {
    "message": {
      "type": "string"
    },
    "instruction": {
      "type": "string"
    },
    "personalityOverride": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Bot response generated successfully
- **403**: Bot is disabled

---

### Get user's bot settings

`GET` **/api/enhanced-bot/settings**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: Bot settings retrieved successfully

---

### Update bot settings

`PUT` **/api/enhanced-bot/settings**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "$ref": "#/components/schemas/BotSettings"
}
```

#### Responses

- **200**: Settings updated successfully

---

### Get available bot personalities

`GET` **/api/enhanced-bot/personalities**

#### Responses

- **200**: Available personalities retrieved successfully

---

### Get conversation history

`GET` **/api/enhanced-bot/conversation-history**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| limit | query | number | No | Number of conversations to retrieve |
| page | query | number | No | Page number |

#### Responses

- **200**: Conversation history retrieved successfully

---

### Get bot usage analytics

`GET` **/api/enhanced-bot/analytics**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: Analytics retrieved successfully

---

### Generate image using AI

`POST` **/api/enhanced-bot/generate-image**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "prompt"
  ],
  "properties": {
    "prompt": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Image generated successfully
- **403**: Image generation not available

---

### Summarize conversation history

`POST` **/api/enhanced-bot/summarize-conversation**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "days": {
      "type": "number",
      "default": 7
    }
  }
}
```

#### Responses

- **200**: Conversation summarized successfully

---

### Rate bot response

`POST` **/api/enhanced-bot/rate-response**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "conversationId",
    "rating"
  ],
  "properties": {
    "conversationId": {
      "type": "string"
    },
    "rating": {
      "type": "number",
      "minimum": 1,
      "maximum": 5
    },
    "feedback": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Response rated successfully

---

## Enhanced Chat

### Get enhanced chat system information

`GET` **/api/chat-info**

Retrieve detailed information about the enhanced chat system capabilities and statistics

#### Responses

- **200**: Chat system information

---

### WebSocket (Socket.IO) API Documentation

`GET` **/websocket**


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

- **200**: WebSocket documentation page (Markdown)

---

### Get user's conversations

`GET` **/api/enhanced-chat/conversations**

Retrieve paginated list of user's conversations with unread message counts and last message preview

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No |  |
| limit | query | integer | No |  |

#### Responses

- **200**: Conversations retrieved successfully
- **401**: Unauthorized

---

### Get messages for a chat

`GET` **/api/enhanced-chat/messages/{chatId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| chatId | path | string | Yes |  |
| page | query | integer | No |  |
| limit | query | integer | No |  |
| before | query | string | No | Message ID to load messages before |

#### Responses

- **200**: Messages retrieved successfully

---

### Send a text message

`POST` **/api/enhanced-chat/send-message**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "receiverId": {
      "type": "string"
    },
    "chatId": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "messageType": {
      "type": "string",
      "enum": [
        "text",
        "emoji"
      ]
    },
    "replyToId": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Message sent successfully

---

### Upload a voice message

`POST` **/api/enhanced-chat/upload-voice**

Upload recorded voice message with waveform data and automatic duration detection

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| voice | formData | string | Yes |  |
| receiverId | formData | string | Yes |  |
| chatId | formData | string | Yes |  |
| duration | formData | string | Yes |  |

#### Responses

- **200**: Voice message uploaded successfully

---

### Upload a file/image/video

`POST` **/api/enhanced-chat/upload-file**

Upload files up to 100MB with automatic type detection and thumbnail generation

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: File uploaded successfully

---

### Add emoji reaction to message

`POST` **/api/enhanced-chat/emoji-reactions/{messageId}**

Add emoji reaction to a specific message with real-time synchronization

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "emoji": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Reaction added successfully

---

### Remove emoji reaction from message

`DELETE` **/api/enhanced-chat/emoji-reactions/{messageId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| messageId | path | string | Yes |  |
| emoji | query | string | Yes |  |

#### Responses

- **200**: Reaction removed successfully

---

### Chat with AI bot

`POST` **/api/enhanced-chat/bot-chat**

Send message to AI bot with customizable personality and get intelligent response

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    },
    "chatId": {
      "type": "string"
    },
    "personality": {
      "type": "string",
      "enum": [
        "friendly",
        "professional",
        "sarcastic",
        "creative",
        "analytical",
        "mentor",
        "companion"
      ]
    },
    "instruction": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Bot response generated successfully

---

### Create a new chat

`POST` **/api/enhanced-chat/create-chat**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "participants": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "isGroup": {
      "type": "boolean"
    },
    "groupName": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Chat created successfully

---

### Mark all messages in chat as read

`POST` **/api/enhanced-chat/mark-read/{chatId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| chatId | path | string | Yes |  |

#### Responses

- **200**: Messages marked as read successfully

---

### Search messages

`GET` **/api/enhanced-chat/search**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| q | query | string | Yes |  |
| chatId | query | string | No |  |
| messageType | query | string | No |  |
| limit | query | integer | No |  |

#### Responses

- **200**: Search results

---

### Get popular emojis list

`GET` **/api/enhanced-chat/emoji-list**

Retrieve categorized list of popular emojis for chat interface

#### Responses

- **200**: Emoji list retrieved successfully

---

## Explore

### Get explore feed with trending content, suggested users, and communities

`GET` **/api/explore**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of posts per page |

#### Responses

- **200**: Explore feed retrieved successfully
- **401**: Unauthorized

---

## File Upload

### Apply a filter to a photo

`POST` **/api/photo/edit**

Upload a photo and apply a filter (greyscale, blur, rotate). Returns the URL to the edited photo.

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "photo": {
      "type": "string",
      "format": "binary",
      "description": "Photo file to upload"
    },
    "filter": {
      "type": "string",
      "enum": [
        "greyscale",
        "blur",
        "rotate"
      ],
      "description": "Type of filter to apply"
    }
  },
  "required": [
    "photo",
    "filter"
  ]
}
```

#### Responses

- **200**: Edited photo URL
- **500**: Error editing photo

---

### Apply an effect to a video

`POST` **/api/video/edit**

Upload a video and apply an effect (grayscale, negate, blur). Returns the URL to the edited video.

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "video": {
      "type": "string",
      "format": "binary",
      "description": "Video file to upload"
    },
    "effect": {
      "type": "string",
      "enum": [
        "grayscale",
        "negate",
        "blur"
      ],
      "description": "Type of effect to apply"
    }
  },
  "required": [
    "video",
    "effect"
  ]
}
```

#### Responses

- **200**: Edited video URL
- **500**: Error editing video

---

### Upload a file/image/video

`POST` **/api/enhanced-chat/upload-file**

Upload files up to 100MB with automatic type detection and thumbnail generation

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: File uploaded successfully

---

## Interests

### Create a new interest (Admin only)

`POST` **/api/interests**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "name",
    "displayName"
  ],
  "properties": {
    "name": {
      "type": "string"
    },
    "displayName": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    }
  }
}
```

#### Responses

- **201**: Interest created successfully
- **400**: Bad request
- **401**: Unauthorized
- **409**: Interest already exists

---

### Get all active interests

`GET` **/api/interests**

#### Responses

- **200**: List of active interests

---

### Update an interest (Admin only)

`PUT` **/api/interests/{id}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "displayName": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    },
    "isActive": {
      "type": "boolean"
    }
  }
}
```

#### Responses

- **200**: Interest updated successfully
- **404**: Interest not found

---

### Delete an interest (Admin only)

`DELETE` **/api/interests/{id}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes |  |

#### Responses

- **200**: Interest deleted successfully
- **404**: Interest not found

---

## Payments

### Initiate a payment

`POST` **/api/payments/pay**

Initiates a payment and returns a payment link

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "description": "Amount to be paid"
    },
    "currency": {
      "type": "string",
      "description": "Currency for the payment"
    }
  },
  "required": [
    "amount",
    "currency"
  ]
}
```

#### Responses

- **200**: Payment link generated successfully
- **400**: Bad request

---

### Verify a payment

`GET` **/api/payments/verify**

Verifies the payment status using the payment ID

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| paymentId | query | string | Yes | ID of the payment to verify |

#### Responses

- **200**: Payment verified successfully
- **400**: Bad request

---

## Photo Effects

### Apply a filter to a photo

`POST` **/api/photo/edit**

Upload a photo and apply a filter (greyscale, blur, rotate). Returns the URL to the edited photo.

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "photo": {
      "type": "string",
      "format": "binary",
      "description": "Photo file to upload"
    },
    "filter": {
      "type": "string",
      "enum": [
        "greyscale",
        "blur",
        "rotate"
      ],
      "description": "Type of filter to apply"
    }
  },
  "required": [
    "photo",
    "filter"
  ]
}
```

#### Responses

- **200**: Edited photo URL
- **500**: Error editing photo

---

## Post Transfer

### Transfer a post to another user

`POST` **/api/posts/transfer**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "postId",
    "toUserId"
  ],
  "properties": {
    "postId": {
      "type": "string",
      "description": "ID of the post to transfer"
    },
    "toUserId": {
      "type": "string",
      "description": "ID of the user to transfer to"
    },
    "reason": {
      "type": "string",
      "description": "Optional reason for transfer"
    }
  }
}
```

#### Responses

- **200**: Post transferred successfully
- **400**: Invalid request
- **403**: Not authorized to transfer this post
- **404**: Post or user not found

---

### Get transfer history of a post

`GET` **/api/posts/transfer-history/{postId}**

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| postId | path | string | Yes | Post ID |

#### Responses

- **200**: Transfer history retrieved successfully
- **404**: Post not found

---

## Profile

### Get profile completion status

`GET` **/api/auth/profile-completion**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: Profile completion status

---

### Get user profile

`GET` **/api/profile**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: User profile retrieved successfully
- **401**: Unauthorized
- **403**: Forbidden
- **500**: Server error

---

### Update user profile

`PUT` **/api/profile/update**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "username": {
      "type": "string"
    },
    "email": {
      "type": "string"
    },
    "profilePic": {
      "type": "string"
    },
    "bio": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: User profile updated successfully
- **400**: Bad request
- **401**: Unauthorized

---

### Change user password

`PUT` **/api/profile/change-password**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "currentPassword",
    "newPassword"
  ],
  "properties": {
    "currentPassword": {
      "type": "string"
    },
    "newPassword": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Password changed successfully
- **400**: Bad request
- **401**: Unauthorized

---

### Delete user account

`DELETE` **/api/profile/delete-account**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: User account deleted successfully
- **401**: Unauthorized

---

### Get list of followers

`GET` **/api/profile/followers**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: List of followers retrieved successfully

---

### Get list of users the current user is following

`GET` **/api/profile/following**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: List of following users retrieved successfully

---

### Follow a user

`PUT` **/api/profile/follow/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes |  |

#### Responses

- **200**: Successfully followed the user

---

### Unfollow a user

`DELETE` **/api/profile/unfollow/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes |  |

#### Responses

- **200**: Successfully unfollowed the user

---

### Upload or update profile picture

`PUT` **/api/users/profile-picture**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "image": {
      "type": "string",
      "format": "binary"
    }
  }
}
```

#### Responses

- **200**: Profile picture updated successfully
- **400**: Bad request
- **401**: Unauthorized
- **500**: Server error

---

## Security

### Block a user

`POST` **/api/security/block/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to block |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "description": "Optional reason for blocking"
    }
  }
}
```

#### Responses

- **200**: User blocked successfully
- **400**: Bad request (cannot block yourself, user already blocked)
- **404**: User not found
- **500**: Server error

---

### Unblock a user

`DELETE` **/api/security/block/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to unblock |

#### Responses

- **200**: User unblocked successfully
- **400**: User is not blocked
- **404**: User not found
- **500**: Server error

---

### Get list of blocked users

`GET` **/api/security/blocked**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |

#### Responses

- **200**: List of blocked users retrieved successfully
- **404**: User not found
- **500**: Server error

---

### Check if a user is blocked

`GET` **/api/security/block-status/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to check block status for |

#### Responses

- **200**: Block status retrieved successfully
- **500**: Server error

---

### Update privacy settings

`PUT` **/api/security/privacy**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "isPrivate": {
      "type": "boolean",
      "description": "Make account private"
    },
    "allowFollowRequests": {
      "type": "boolean",
      "description": "Allow follow requests for private accounts"
    },
    "showOnlineStatus": {
      "type": "boolean",
      "description": "Show online status to others"
    },
    "allowDirectMessages": {
      "type": "string",
      "enum": [
        "everyone",
        "followers",
        "none"
      ],
      "description": "Who can send direct messages"
    }
  }
}
```

#### Responses

- **200**: Privacy settings updated successfully
- **400**: Invalid privacy settings
- **500**: Server error

---

### Get current privacy settings

`GET` **/api/security/privacy**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: Privacy settings retrieved successfully
- **404**: User not found
- **500**: Server error

---

### Send a follow request

`POST` **/api/security/follow-request/{userId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| userId | path | string | Yes | ID of the user to send follow request to |

#### Responses

- **200**: Follow request sent successfully
- **400**: Bad request (already following, request already sent, etc.)
- **404**: User not found
- **500**: Server error

---

### Handle a follow request (approve or reject)

`PUT` **/api/security/follow-request/{requesterId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| requesterId | path | string | Yes | ID of the user who sent the follow request |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": [
        "approve",
        "reject"
      ],
      "description": "Action to take on the follow request"
    }
  }
}
```

#### Responses

- **200**: Follow request handled successfully
- **400**: Invalid action or request not found
- **404**: User not found
- **500**: Server error

---

### Get follow requests

`GET` **/api/security/follow-requests**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| status | query | string | No | Filter by request status |
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |

#### Responses

- **200**: Follow requests retrieved successfully
- **404**: User not found
- **500**: Server error

---

### Initialize 2FA setup

`POST` **/api/security/2fa/setup**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: 2FA setup initialized successfully
- **400**: 2FA already enabled
- **500**: Server error

---

### Complete 2FA setup with verification

`POST` **/api/security/2fa/verify-setup**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "secret": {
      "type": "string",
      "description": "The secret key from setup"
    },
    "token": {
      "type": "string",
      "description": "6-digit TOTP token from authenticator app"
    }
  },
  "required": [
    "secret",
    "token"
  ]
}
```

#### Responses

- **200**: 2FA enabled successfully
- **400**: Invalid token or 2FA already enabled
- **500**: Server error

---

### Verify 2FA token during login

`POST` **/api/security/2fa/verify**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "token": {
      "type": "string",
      "description": "6-digit TOTP token from authenticator app"
    }
  },
  "required": [
    "token"
  ]
}
```

#### Responses

- **200**: 2FA verification successful
- **400**: Invalid token or 2FA not enabled
- **500**: Server error

---

### Disable 2FA

`DELETE` **/api/security/2fa**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "password": {
      "type": "string",
      "description": "Current account password"
    },
    "token": {
      "type": "string",
      "description": "6-digit TOTP token from authenticator app"
    }
  },
  "required": [
    "password",
    "token"
  ]
}
```

#### Responses

- **200**: 2FA disabled successfully
- **400**: Invalid password/token or 2FA not enabled
- **500**: Server error

---

### Generate new backup codes

`POST` **/api/security/2fa/backup-codes**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "token": {
      "type": "string",
      "description": "6-digit TOTP token from authenticator app"
    }
  },
  "required": [
    "token"
  ]
}
```

#### Responses

- **200**: Backup codes generated successfully
- **400**: Invalid token or 2FA not enabled
- **500**: Server error

---

### Verify backup code for emergency access

`POST` **/api/security/2fa/backup-verify**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "8-character backup code"
    }
  },
  "required": [
    "code"
  ]
}
```

#### Responses

- **200**: Backup code verification result
- **400**: Invalid backup code or 2FA not enabled
- **500**: Server error

---

### Get 2FA status

`GET` **/api/security/2fa/status**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: 2FA status retrieved successfully
- **500**: Server error

---

### Get user's security events

`GET` **/api/security/events**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| eventType | query | string | No | Filter by event type |
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of results per page |
| startDate | query | string | No | Start date for filtering events |
| endDate | query | string | No | End date for filtering events |

#### Responses

- **200**: Security events retrieved successfully
- **500**: Server error

---

### Get user's security statistics

`GET` **/api/security/stats**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| days | query | integer | No | Number of days to look back for statistics |

#### Responses

- **200**: Security statistics retrieved successfully
- **500**: Server error

---

## Spaces

### Create a Live Audio Space

`POST` **/api/spaces/create**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "title"
  ],
  "properties": {
    "title": {
      "type": "string",
      "description": "Title of the space"
    }
  }
}
```

#### Responses

- **200**: Space created successfully
- **400**: Bad request

---

### End a Live Audio Space

`PATCH` **/api/spaces/{spaceId}/end**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| spaceId | path | string | Yes | Space ID |

#### Responses

- **200**: Space ended successfully
- **403**: Only host can end space
- **404**: Space not found

---

### Add a video highlight to a space

`PUT` **/api/spaces/{spaceId}/highlight**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| spaceId | path | string | Yes | Space ID |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "videoUrl"
  ],
  "properties": {
    "videoUrl": {
      "type": "string",
      "description": "URL of the highlight video"
    }
  }
}
```

#### Responses

- **200**: Highlight added successfully
- **404**: Space not found

---

## Status

### Create a new status (image, text, or video)

`POST` **/api/status**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "type",
    "content"
  ],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "text",
        "image",
        "video"
      ]
    },
    "content": {
      "type": "string"
    }
  }
}
```

#### Responses

- **201**: Status created successfully
- **400**: Bad request

---

### Get active statuses from followers

`GET` **/api/status**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: List of active statuses

---

### Delete a status

`DELETE` **/api/status/{id}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes |  |

#### Responses

- **200**: Status deleted successfully

---

### React to a status

`POST` **/api/status/{id}/react**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes |  |

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "emoji"
  ],
  "properties": {
    "emoji": {
      "type": "string"
    }
  }
}
```

#### Responses

- **200**: Reaction added successfully

---

## Subscription

### Subscribe to Golden Tick

`POST` **/api/subscription/subscribe**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "userId",
    "paymentSuccess"
  ],
  "properties": {
    "userId": {
      "type": "string",
      "description": "Unique identifier of the user"
    },
    "paymentSuccess": {
      "type": "boolean",
      "description": "Status of payment transaction"
    }
  }
}
```

#### Responses

- **200**: Golden Tick activated successfully
- **400**: Bad request, invalid input
- **401**: Unauthorized, authentication required
- **500**: Internal server error

---

## System

### System health check

`GET` **/health**

Get system health status and feature availability

#### Responses

- **200**: System health information

---

### Get enhanced chat system information

`GET` **/api/chat-info**

Retrieve detailed information about the enhanced chat system capabilities and statistics

#### Responses

- **200**: Chat system information

---

### WebSocket (Socket.IO) API Documentation

`GET` **/websocket**


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

- **200**: WebSocket documentation page (Markdown)

---

## User Interests

### Get user's interests

`GET` **/api/user/interests**

**Security**: [{"bearerAuth":[]}]

#### Responses

- **200**: User's interests

---

### Update user's interests

`POST` **/api/user/interests**

**Security**: [{"bearerAuth":[]}]

#### Request Body

**Content-Type**: `application/json`

```json
{
  "type": "object",
  "required": [
    "interestIds"
  ],
  "properties": {
    "interestIds": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of interest IDs"
    }
  }
}
```

#### Responses

- **200**: Interests updated successfully
- **400**: Invalid interest IDs

---

### Remove an interest from user's interests

`DELETE` **/api/user/interests/{interestId}**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| interestId | path | string | Yes |  |

#### Responses

- **200**: Interest removed successfully
- **404**: Interest not found in user's interests

---

## Users

### Get user by ID

`GET` **/api/users/{id}**

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string | Yes |  |

#### Responses

- **200**: User retrieved
- **404**: User not found
- **500**: Server error

---

### Get all users

`GET` **/api/users**

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| page | query | integer | No | Page number for pagination |
| limit | query | integer | No | Number of users per page |
| search | query | string | No | Search users by name or username |

#### Responses

- **200**: List of users retrieved successfully
- **401**: Unauthorized
- **500**: Server error

---

## Video Effects

### Apply an effect to a video

`POST` **/api/video/edit**

Upload a video and apply an effect (grayscale, negate, blur). Returns the URL to the edited video.

#### Request Body

**Content-Type**: `multipart/form-data`

```json
{
  "type": "object",
  "properties": {
    "video": {
      "type": "string",
      "format": "binary",
      "description": "Video file to upload"
    },
    "effect": {
      "type": "string",
      "enum": [
        "grayscale",
        "negate",
        "blur"
      ],
      "description": "Type of effect to apply"
    }
  },
  "required": [
    "video",
    "effect"
  ]
}
```

#### Responses

- **200**: Edited video URL
- **500**: Error editing video

---

## Voice Messages

### Upload a voice message

`POST` **/api/enhanced-chat/upload-voice**

Upload recorded voice message with waveform data and automatic duration detection

**Security**: [{"bearerAuth":[]}]

#### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| voice | formData | string | Yes |  |
| receiverId | formData | string | Yes |  |
| chatId | formData | string | Yes |  |
| duration | formData | string | Yes |  |

#### Responses

- **200**: Voice message uploaded successfully

---

## WebRTC Calls

### WebRTC signaling event (socket.io)

`POST` **/socket.io/webrtc-signaling**


                    Use socket.io to emit and listen for the following events for video/voice calls:
                    - call-offer: Send a WebRTC offer to another user
                    - call-answer: Send a WebRTC answer in response to an offer
                    - ice-candidate: Exchange ICE candidates for peer connection
                    


                    Example socket.io payloads:
                    - call-offer: { target: '<socketId>', offer: { ...SDP } }
                    - call-answer: { target: '<socketId>', answer: { ...SDP } }
                    - ice-candidate: { target: '<socketId>', candidate: { ...ICE } }
                

#### Request Body

**Content-Type**: `application/json`

```json
{
  "$ref": "#/components/schemas/WebRTCSignal"
}
```

#### Responses

- **200**: Signal relayed successfully (socket.io emits to target)

---

### WebSocket (Socket.IO) API Documentation

`GET` **/websocket**


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

- **200**: WebSocket documentation page (Markdown)

---

