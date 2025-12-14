# Railway Deployment Troubleshooting Guide

## 🚨 Current Issue: 502 Connection Refused

The error you're seeing indicates that your app is failing to start on Railway. Here's how to diagnose and fix it:

```json
{
  "httpStatus": 502,
  "upstreamErrors": [
    {"error": "connection refused"}
  ]
}
```

## 🔍 Diagnosis Steps

### Step 1: Check Railway Logs
```bash
railway logs
```
Look for specific error messages during startup.

### Step 2: Use Debug Server
Temporarily switch to the debug server to isolate the issue:

1. **Update Railway Environment Variable**:
   - Go to Railway dashboard → Variables
   - Add: `START_COMMAND=npm run start:debug`
   - Or change the start script temporarily

2. **Deploy Debug Server**:
   ```bash
   railway up
   ```

3. **Test Debug Endpoints**:
   - Health: `https://your-app.railway.app/health`
   - DB Test: `https://your-app.railway.app/db-test`
   - Env Check: `https://your-app.railway.app/env-check`

## 🛠️ Common Fixes

### Fix 1: Environment Variables
Ensure all required environment variables are set in Railway:

**Essential Variables:**
```env
NODE_ENV=production
PORT=9876
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_jwt_secret_here
```

**Check in Railway Dashboard:**
1. Go to your project → Variables tab
2. Verify all variables are set
3. No typos in variable names
4. MongoDB URI is valid and accessible

### Fix 2: MongoDB Atlas Configuration
1. **Whitelist Railway IPs**: Set to `0.0.0.0/0` (allow all IPs)
2. **Check Database User**: Ensure user has read/write permissions
3. **Test Connection**: Use MongoDB Compass with the same URI

### Fix 3: Port Configuration
Railway automatically assigns PORT, but ensure your app uses it:

```javascript
const PORT = process.env.PORT || 9876;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Fix 4: Dependencies Issues
Check if all dependencies are properly installed:

```bash
# In Railway logs, look for:
npm ERR! missing script: start
npm ERR! peer dep missing
```

**Solution**: Ensure package.json has all required dependencies.

### Fix 5: Memory/Resource Limits
Railway has resource limits. Large apps might need optimization:

1. **Reduce Imports**: Comment out unused route imports temporarily
2. **Lazy Loading**: Load heavy modules only when needed
3. **Memory Optimization**: Check for memory leaks

## 🚀 Quick Fixes to Try

### Option 1: Minimal Server Deployment
1. **Temporarily replace server.js content** with minimal version:

```javascript
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9876;

app.get('/', (req, res) => {
  res.json({ message: 'Aeko Backend - Minimal Mode', status: 'OK' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${PORT}`);
});
```

2. **Deploy and test**
3. **Gradually add features back**

### Option 2: Environment Variable Fix
Add these to Railway dashboard:

```env
# Core
NODE_ENV=production
PORT=9876

# Database (CRITICAL - must be valid)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db

# Security
JWT_SECRET=your_strong_jwt_secret_here

# Optional (can be dummy values for testing)
FRONTEND_URL=https://your-frontend.com
GOOGLE_CLIENT_ID=dummy
GOOGLE_CLIENT_SECRET=dummy
CLOUDINARY_CLOUD_NAME=dummy
CLOUDINARY_API_KEY=dummy
CLOUDINARY_API_SECRET=dummy
```

### Option 3: Package.json Fix
Ensure your package.json has the correct start script:

```json
{
  "scripts": {
    "start": "node server.js",
    "start:debug": "node railway-debug.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🔧 Railway-Specific Commands

```bash
# View real-time logs
railway logs --follow

# Check deployment status
railway status

# Redeploy
railway up

# Check environment variables
railway variables

# Connect to Railway shell (if available)
railway shell
```

## 📋 Debugging Checklist

- [ ] **Railway logs show specific error message**
- [ ] **All environment variables are set**
- [ ] **MongoDB URI is valid and accessible**
- [ ] **PORT is correctly configured**
- [ ] **No syntax errors in server.js**
- [ ] **All imported files exist**
- [ ] **Dependencies are properly installed**
- [ ] **Debug server works**
- [ ] **Minimal server works**

## 🆘 Emergency Deployment

If you need to get something working immediately:

1. **Use the debug server**:
   ```bash
   # Change start script in package.json
   "start": "node railway-debug.js"
   ```

2. **Deploy minimal version**:
   ```bash
   railway up
   ```

3. **Test basic functionality**:
   ```bash
   curl https://your-app.railway.app/health
   ```

4. **Gradually add features back**

## 📞 Next Steps

1. **Run the debug server first** to identify the exact issue
2. **Check Railway logs** for specific error messages
3. **Verify environment variables** are correctly set
4. **Test database connection** separately
5. **Use minimal server** if main server fails

The debug server will help identify whether the issue is:
- Environment variables
- Database connection
- Code syntax/imports
- Resource limits
- Railway configuration

Let me know what the debug server shows and we can fix the specific issue!