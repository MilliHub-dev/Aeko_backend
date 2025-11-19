# Google OAuth Quick Reference

Quick reference for implementing Google OAuth in your frontend.

---

## 🚀 Quick Start

### 1. Backend Setup (5 minutes)

```bash
# Install dependencies
npm install

# Configure .env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
OAUTH_SUCCESS_REDIRECT=http://localhost:3000/auth/success
OAUTH_FAILURE_REDIRECT=http://localhost:3000/auth/failed

# Test configuration
npm run test:oauth

# Start server
npm run dev
```

### 2. Frontend Setup (10 minutes)

```javascript
// 1. Create login button
const handleGoogleLogin = () => {
  window.location.href = 'http://localhost:5000/api/auth/google';
};

// 2. Create success page at /auth/success
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) {
    localStorage.setItem('authToken', token);
    router.push('/dashboard');
  }
}, []);

// 3. Make authenticated requests
fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` },
  credentials: 'include'
});
```

---

## 📡 API Endpoints

### Initiate OAuth
```
GET /api/auth/google
→ Redirects to Google
```

### Get Current User
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
→ Returns user object
```

### Logout
```
POST /api/auth/logout
→ Clears cookies
```

---

## 🔑 Token Handling

### Where is the token?
1. **URL parameter**: `?token=xxx` (in success redirect)
2. **HttpOnly cookie**: `token` (set automatically)

### How to use it?
```javascript
// Option 1: From URL
const token = new URLSearchParams(window.location.search).get('token');
localStorage.setItem('authToken', token);

// Option 2: From cookie (automatic)
fetch('/api/endpoint', { credentials: 'include' });

// Option 3: From localStorage
const token = localStorage.getItem('authToken');
fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🎨 React Component Example

```jsx
// GoogleLoginButton.jsx
export default function GoogleLoginButton() {
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
  };
  
  return (
    <button onClick={handleLogin}>
      Continue with Google
    </button>
  );
}

// AuthSuccess.jsx
export default function AuthSuccess() {
  const router = useRouter();
  
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('authToken', token);
      router.push('/dashboard');
    }
  }, []);
  
  return <div>Signing in...</div>;
}

// AuthFailed.jsx
export default function AuthFailed() {
  const router = useRouter();
  const message = new URLSearchParams(window.location.search).get('message');
  
  return (
    <div>
      <h1>Authentication Failed</h1>
      <p>{message || 'Please try again'}</p>
      <button onClick={() => router.push('/login')}>Back to Login</button>
    </div>
  );
}
```

---

## 🔒 Security Checklist

- [ ] HTTPS in production
- [ ] Secure cookies (`secure: true`)
- [ ] CORS configured
- [ ] Token expiration handled
- [ ] Logout clears tokens
- [ ] Error handling implemented

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Redirect URI mismatch" | Check Google Console callback URL matches `.env` |
| "Token not found" | Check success URL and URL parsing |
| "CORS error" | Add `credentials: 'include'` and configure CORS |
| "401 Unauthorized" | Check token is being sent in requests |

---

## 📚 Full Documentation

- Setup Guide: `docs/GOOGLE_OAUTH_SETUP_GUIDE.md`
- Implementation Analysis: `docs/GOOGLE_OAUTH_IMPLEMENTATION_ANALYSIS.md`
- Test Configuration: `npm run test:oauth`

---

## 🆘 Need Help?

1. Run `npm run test:oauth` to check configuration
2. Check server logs for errors
3. Verify Google Cloud Console settings
4. See full documentation in `docs/` folder
