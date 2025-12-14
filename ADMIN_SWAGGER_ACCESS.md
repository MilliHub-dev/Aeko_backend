# Admin Panel & Swagger Docs Access Guide

## 🔧 Admin Panel Access

### Production (Railway)
- **URL**: `https://your-app.railway.app/admin`
- **Login Page**: `https://your-app.railway.app/admin/login`

### Development
- **URL**: `http://localhost:9876/admin`
- **Login Page**: `http://localhost:9876/admin/login`

### Admin Features
- **User Management**: Ban/unban users, grant verification ticks
- **Content Moderation**: Flag inappropriate content, manage posts
- **Analytics**: View user statistics, transaction analytics
- **Blockchain Monitoring**: Track Aeko transactions, NFT marketplace
- **AI Bot Management**: Configure bot personalities, view conversations
- **LiveStream Management**: Monitor streams, end inappropriate streams
- **Advertisement Management**: Approve/reject ads, view performance

### Creating Admin Users

#### Method 1: First Admin Endpoint (No Auth Required)
```bash
curl -X POST https://your-app.railway.app/api/admin/setup/first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "your-secure-password"
  }'
```

#### Method 2: Using Admin Creation Script
```bash
node create-admin.js
```
**Default Credentials**:
- Email: `admin@aeko.com`
- Password: `admin123`
- **⚠️ Change immediately after first login!**

#### Method 3: Promote Existing User
1. Register a normal user via `/api/auth/register`
2. Update user in database: `{ isAdmin: true }`
3. Or use admin panel to promote user

---

## 📚 Swagger API Documentation

### Production (Railway)
- **Interactive Docs**: `https://your-app.railway.app/api-docs`
- **OpenAPI Spec**: `https://your-app.railway.app/api-docs.json`

### Development
- **Interactive Docs**: `http://localhost:9876/api-docs`
- **OpenAPI Spec**: `http://localhost:9876/api-docs.json`

### Swagger Features
- **Interactive Testing**: Test API endpoints directly from the browser
- **Authentication**: Built-in JWT token authentication
- **Complete Documentation**: All endpoints with request/response schemas
- **Real-time Updates**: Documentation updates automatically with code changes
- **Multiple Environments**: Switch between development and production servers

### Using Swagger UI
1. **Navigate** to `/api-docs`
2. **Authenticate**: Click "Authorize" button, enter `Bearer YOUR_JWT_TOKEN`
3. **Test Endpoints**: Expand any endpoint and click "Try it out"
4. **View Schemas**: Check request/response models in the schemas section

---

## 🧪 Testing Access

### Quick Test Script
```bash
# Test both admin and swagger accessibility
node test-admin-swagger.js https://your-app.railway.app
```

### Manual Testing
```bash
# Test admin panel
curl -I https://your-app.railway.app/admin

# Test swagger docs
curl -I https://your-app.railway.app/api-docs

# Test swagger JSON spec
curl https://your-app.railway.app/api-docs.json | jq '.info.title'
```

---

## 🔒 Security Considerations

### Admin Panel Security
- **Strong Passwords**: Use complex passwords for admin accounts
- **Limited Access**: Only create admin accounts for trusted users
- **Regular Audits**: Monitor admin actions and user changes
- **Environment Variables**: Keep admin secrets in environment variables

### API Documentation Security
- **Production Access**: Swagger docs are publicly accessible (by design)
- **Sensitive Data**: No sensitive information is exposed in documentation
- **Authentication Required**: All protected endpoints require valid JWT tokens
- **Rate Limiting**: API endpoints have rate limiting enabled

---

## 🚨 Troubleshooting

### Admin Panel Issues
- **404 Error**: Check if admin routes are properly mounted in server.js
- **Login Failed**: Verify admin user exists and has `isAdmin: true`
- **Styling Issues**: Check if AdminJS assets are loading correctly
- **Database Errors**: Verify MongoDB connection and user permissions

### Swagger Issues
- **404 Error**: Check if swagger routes are properly configured
- **Spec Not Loading**: Verify swagger.js is properly imported and called
- **Authentication Issues**: Check JWT token format and validity
- **CORS Errors**: Verify CORS settings allow swagger domain

### Common Solutions
```bash
# Check server logs
railway logs

# Verify environment variables
railway variables

# Test database connection
curl https://your-app.railway.app/api/health

# Check admin user exists
# Use MongoDB compass or admin panel to verify user has isAdmin: true
```

---

## 📋 Quick Reference

| Feature | Development URL | Production URL |
|---------|----------------|----------------|
| Admin Panel | `http://localhost:9876/admin` | `https://your-app.railway.app/admin` |
| Admin Login | `http://localhost:9876/admin/login` | `https://your-app.railway.app/admin/login` |
| Swagger UI | `http://localhost:9876/api-docs` | `https://your-app.railway.app/api-docs` |
| API Spec | `http://localhost:9876/api-docs.json` | `https://your-app.railway.app/api-docs.json` |
| Health Check | `http://localhost:9876/api/health` | `https://your-app.railway.app/api/health` |

**🎉 Both Admin Panel and Swagger Docs are fully configured and ready for Railway deployment!**