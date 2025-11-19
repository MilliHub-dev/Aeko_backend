# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth for your application.

---

## 1. Backend Setup

### Step 1: Install Dependencies

```bash
npm install google-auth-library
```

The package has already been added to `package.json`. Run:

```bash
npm install
```

### Step 2: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Configure:
     - **Name**: Your App Name (e.g., "Aeko Backend")
     - **Authorized JavaScript origins**: 
       - `http://localhost:5000` (development)
       - `https://yourdomain.com` (production)
     - **Authorized redirect URIs**:
       - `http://localhost:5000/api/auth/google/callback` (development)
       - `https://yourdomain.com/api/auth/google/callback` (production)
   - Click "Create"
   - Copy the **Client ID** and **Client Secret**

### Step 3: Configure Environment Variables

Add these to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_actual_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# OAuth Redirect URLs (Frontend)
OAUTH_SUCCESS_REDIRECT=http://localhost:3000/auth/success
OAUTH_FAILURE_REDIRECT=http://localhost:3000/auth/failed
```

**Production values:**
```env
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
OAUTH_SUCCESS_REDIRECT=https://yourdomain.com/auth/success
OAUTH_FAILURE_REDIRECT=https://yourdomain.com/auth/failed
```

### Step 4: Restart Your Server

```bash
npm run dev
```

---

## 2. Frontend Setup

### Step 1: Create OAuth Success Page

Create a page at `/auth/success` to handle successful authentication:

```javascript
// pages/auth/success.jsx (Next.js) or src/pages/AuthSuccess.jsx (React)
import { useEffect } from 'react';
import { useRouter } from 'next/router'; // or useNavigate for React Router

export default function AuthSuccess() {
  const router = useRouter();
  
  useEffect(() => {
    // Get token from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      
      // Optionally fetch user data
      fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include' // Include cookies
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect to dashboard
            router.push('/dashboard');
          } else {
            throw new Error('Failed to fetch user data');
          }
        })
        .catch(err => {
          console.error('Error:', err);
          router.push('/login');
        });
    } else {
      // No token, redirect to login
      router.push('/login');
    }
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Completing sign in...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    </div>
  );
}
```

### Step 2: Create OAuth Failure Page

Create a page at `/auth/failed` to handle authentication failures:

```javascript
// pages/auth/failed.jsx (Next.js) or src/pages/AuthFailed.jsx (React)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router'; // or useNavigate for React Router

export default function AuthFailed() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('Authentication failed');
  
  useEffect(() => {
    // Get error details from URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const message = urlParams.get('message');
    
    if (message) {
      setErrorMessage(decodeURIComponent(message));
    }
    
    // Redirect to login after 5 seconds
    const timeout = setTimeout(() => {
      router.push('/login');
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md p-8">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-4">Authentication Failed</h2>
        <p className="text-gray-600 mb-6">{errorMessage}</p>
        <p className="text-sm text-gray-500">Redirecting to login in 5 seconds...</p>
        <button 
          onClick={() => router.push('/login')}
          className="mt-4 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Login Now
        </button>
      </div>
    </div>
  );
}
```

### Step 3: Create Google Login Button Component

```javascript
// components/GoogleLoginButton.jsx
import { useState } from 'react';

export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  
  const handleGoogleLogin = () => {
    setLoading(true);
    // Redirect to backend OAuth endpoint
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/google`;
  };
  
  return (
    <button 
      onClick={handleGoogleLogin}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {loading ? 'Redirecting...' : 'Continue with Google'}
    </button>
  );
}
```

### Step 4: Use the Button in Your Login Page

```javascript
// pages/login.jsx
import GoogleLoginButton from '../components/GoogleLoginButton';

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold">Sign in to Aeko</h2>
        </div>
        
        <div className="space-y-4">
          {/* Google OAuth Button */}
          <GoogleLoginButton />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>
          
          {/* Regular email/password form */}
          <form className="space-y-4">
            {/* Your existing login form */}
          </form>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Configure Environment Variables

Create `.env.local` (Next.js) or `.env` (React):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

For production:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 3. Making Authenticated Requests

### Option 1: Using Token from localStorage

```javascript
const token = localStorage.getItem('authToken');

fetch('http://localhost:5000/api/protected-route', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### Option 2: Using HttpOnly Cookie

```javascript
fetch('http://localhost:5000/api/protected-route', {
  method: 'GET',
  credentials: 'include', // Important! Sends cookies
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### Option 3: Using Both (Recommended)

```javascript
const token = localStorage.getItem('authToken');

fetch('http://localhost:5000/api/protected-route', {
  method: 'GET',
  credentials: 'include', // Send cookies
  headers: {
    'Authorization': `Bearer ${token}`, // Also send token
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 4. API Endpoints

### Available Endpoints

#### 1. Initiate OAuth Flow
```
GET /api/auth/google
```
Redirects user to Google consent screen.

#### 2. OAuth Callback (Automatic)
```
GET /api/auth/google/callback
```
Handles Google's response and redirects to success/failure URL with token.

#### 3. Get Current User
```
GET /api/auth/me
```
Returns current authenticated user's information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "...",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "profilePicture": "...",
    "avatar": "...",
    "bio": "...",
    "blueTick": false,
    "goldenTick": false,
    "aekoBalance": 0,
    "emailVerification": {
      "isVerified": true
    },
    "profileCompletion": { ... },
    "isAdmin": false,
    "oauthProvider": "google",
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 4. Logout
```
POST /api/auth/logout
```
Clears authentication cookie.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 5. Testing

### Test OAuth Flow

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Start your frontend:
   ```bash
   npm run dev
   ```

3. Navigate to your login page

4. Click "Continue with Google"

5. You should be redirected to Google's consent screen

6. After granting permission, you should be redirected back to `/auth/success` with a token

7. The token should be stored in localStorage and you should be redirected to the dashboard

### Test with cURL

```bash
# Test the /me endpoint with token
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 6. Security Considerations

### Production Checklist

- [ ] Use HTTPS for all OAuth URLs
- [ ] Set `secure: true` for cookies in production
- [ ] Use `sameSite: 'strict'` for cookies in production
- [ ] Add rate limiting to OAuth endpoints
- [ ] Implement CSRF protection
- [ ] Validate redirect URLs
- [ ] Store tokens securely
- [ ] Implement token refresh mechanism
- [ ] Add logging for OAuth events
- [ ] Monitor for suspicious activity

### CORS Configuration

Make sure your backend allows requests from your frontend:

```javascript
// In server.js or app.js
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true // Allow cookies
}));
```

---

## 7. Troubleshooting

### Common Issues

#### 1. "Redirect URI mismatch"
- Make sure the callback URL in Google Cloud Console matches exactly with `GOOGLE_CALLBACK_URL` in your `.env`
- Include the protocol (`http://` or `https://`)
- Check for trailing slashes

#### 2. "Token not found in URL"
- Check browser console for errors
- Verify the success redirect URL is correct
- Check if the token is being passed in the URL

#### 3. "CORS error"
- Make sure CORS is configured to allow your frontend origin
- Include `credentials: true` in CORS config
- Use `credentials: 'include'` in fetch requests

#### 4. "User not authenticated"
- Check if token is being sent in requests
- Verify token is valid (not expired)
- Check if authMiddleware is working correctly

#### 5. "Username already exists"
- The system now automatically handles username collisions by appending numbers
- If you still see this error, check the database for duplicate usernames

---

## 8. What's New

### Recent Improvements

✅ **Token in URL**: Token is now passed in the success redirect URL for easier frontend access

✅ **ID Token Verification**: Added Google ID token verification for enhanced security

✅ **Unique Username Generation**: Automatically handles username collisions

✅ **Better Error Handling**: Errors are now passed to the failure URL with details

✅ **New /me Endpoint**: Get current user information after OAuth

✅ **Improved Logout**: Now properly clears authentication cookies

✅ **Avatar Updates**: User avatar is updated on each login if changed

---

## Need Help?

If you encounter any issues:

1. Check the server logs for error messages
2. Verify all environment variables are set correctly
3. Make sure Google Cloud Console is configured properly
4. Test with the provided cURL commands
5. Check the browser console for frontend errors

For more information, see:
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
