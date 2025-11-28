# OAuth Deep Link & User Endpoints Implementation

## Overview
This implementation adds deep link support for Google OAuth authentication and creates an endpoint to retrieve all users.

## 🔗 Deep Link Implementation

### Deep Link Format
```
aeko://(home)?token=YOUR_JWT_TOKEN_HERE
```

### Modified Endpoints

#### 1. Google OAuth Callback (`/api/auth/google/callback`)
- **Before**: Redirected to web URL with token
- **After**: Redirects to deep link `aeko://(home)?token=JWT_TOKEN`
- **Usage**: Web-based OAuth flow for mobile apps

#### 2. Mobile OAuth (`/api/auth/google/mobile`)
- **Enhancement**: Now includes `deepLink` field in response
- **Response Format**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deepLink": "aeko://(home)?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

#### 3. Regular Login (`/api/auth/login`)
- **Enhancement**: Now includes `deepLink` field in response
- **Consistency**: All authentication endpoints now provide deep link

#### 4. Email Verification (`/api/auth/verify-email`)
- **Enhancement**: Now includes `deepLink` field in response
- **Flow**: After email verification, user gets deep link for app navigation

## 👥 Get All Users Endpoint

### Endpoint: `GET /api/users`

#### Features
- **Pagination**: Support for page and limit parameters
- **Search**: Filter users by name or username
- **Privacy-Aware**: Respects user privacy settings
- **Authentication Required**: Requires valid JWT token

#### Request Parameters
```
GET /api/users?page=1&limit=20&search=john
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Users per page (max 100) |
| `search` | string | - | Search by name or username |

#### Response Format
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "username": "johndoe",
      "profilePicture": "https://example.com/pic.jpg",
      "bio": "Tech enthusiast",
      "blueTick": true,
      "goldenTick": false,
      "followersCount": 150,
      "followingCount": 75,
      "postsCount": 42,
      "createdAt": "2024-01-01T12:00:00Z",
      "emailVerification": { "isVerified": true }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalUsers": 100,
    "hasNext": true,
    "hasPrev": false,
    "limit": 20
  }
}
```

#### Privacy Protection
- Excludes sensitive fields (password, 2FA secrets, etc.)
- For private accounts, only shows basic info unless viewer is a follower
- Respects user privacy settings

## 🔒 Security Features

### Authentication
- All endpoints require valid JWT authentication
- Rate limiting applied via middleware
- Blocking and privacy middleware protection

### Data Protection
- Sensitive fields automatically filtered
- Privacy settings respected
- No exposure of internal user data

## 🧪 Testing

### Test File: `test-oauth-deeplink.js`
Run the test file to verify implementation:
```bash
node test-oauth-deeplink.js
```

### Manual Testing

#### 1. Test OAuth Deep Link
1. Navigate to `/api/auth/google`
2. Complete Google OAuth flow
3. Verify redirect to `aeko://(home)?token=...`

#### 2. Test Get All Users
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:5000/api/users?page=1&limit=10"
```

#### 3. Test Mobile OAuth
```bash
curl -X POST http://localhost:5000/api/auth/google/mobile \
     -H "Content-Type: application/json" \
     -d '{"idToken": "GOOGLE_ID_TOKEN", "user": {"name": "Test User"}}'
```

## 📱 Mobile App Integration

### Handling Deep Links
Your mobile app should register the `aeko://` URL scheme and handle the deep link:

```javascript
// React Native example
import { Linking } from 'react-native';

// Listen for deep links
Linking.addEventListener('url', handleDeepLink);

function handleDeepLink(event) {
  const url = event.url;
  if (url.startsWith('aeko://(home)?token=')) {
    const token = url.split('token=')[1];
    // Store token and navigate to home screen
    AsyncStorage.setItem('authToken', token);
    navigation.navigate('Home');
  }
}
```

## 🔄 Migration Notes

### Existing Users
- No database migration required
- Existing OAuth flows will automatically use new deep link format
- Backward compatibility maintained for web clients

### Environment Variables
No new environment variables required, but you can optionally set:
- `OAUTH_SUCCESS_REDIRECT`: Fallback URL (now defaults to deep link)
- `OAUTH_FAILURE_REDIRECT`: Failure URL (now defaults to deep link)

## 📋 API Documentation

All endpoints are documented with Swagger/OpenAPI specifications. The documentation includes:
- Request/response schemas
- Authentication requirements
- Parameter descriptions
- Example responses

Access the API documentation at `/api-docs` when the server is running.