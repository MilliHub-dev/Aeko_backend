# 🚨 Railway 502 Error - Complete Fix Guide

## Immediate Solution

Your Railway deployment is failing with "connection refused" errors. Here's the step-by-step fix:

### Step 1: Switch to Minimal Server (URGENT)

```bash
# Quick fix - use minimal server
node fix-railway.js minimal
railway up
```

**Test immediately**: `https://aekobackend-production.up.railway.app/health`

### Step 2: Check Environment Variables

Go to Railway Dashboard → Your Project → Variables and ensure these are set:

```env
NODE_ENV=production
PORT=9876
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_jwt_secret_here
```

### Step 3: Test Database Connection

Visit: `https://aekobackend-production.up.railway.app/db-test`

If it fails, check:
- MongoDB Atlas IP whitelist (set to 0.0.0.0/0)
- Database user permissions
- Connection string format

## Root Cause Analysis

The 502 error indicates your main server.js is failing to start. Common causes:

1. **Missing Environment Variables**
2. **Database Connection Issues** 
3. **Import/Dependency Errors**
4. **Memory/Resource Limits**

## Fix Commands

```bash
# Switch to minimal server (safest)
node fix-railway.js minimal

# Switch to debug server (detailed logs)
node fix-railway.js debug

# Switch back to full server (after fixing issues)
node fix-railway.js full

# Test locally first
node fix-railway.js test
```

## Environment Variables Checklist

### Required (Must Have):
- ✅ `NODE_ENV=production`
- ✅ `MONGO_URI=mongodb+srv://...` (valid connection string)
- ✅ `JWT_SECRET=...` (strong secret)

### Optional (Can be dummy for testing):
- `FRONTEND_URL=https://your-frontend.com`
- `GOOGLE_CLIENT_ID=dummy`
- `GOOGLE_CLIENT_SECRET=dummy`
- `CLOUDINARY_CLOUD_NAME=dummy`
- `CLOUDINARY_API_KEY=dummy`
- `CLOUDINARY_API_SECRET=dummy`

## MongoDB Atlas Setup

1. **Whitelist IPs**: Go to Network Access → Add IP → 0.0.0.0/0
2. **Database User**: Ensure user has read/write permissions
3. **Connection String**: Format should be:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/aeko_db
   ```

## Recovery Steps

### Phase 1: Get Minimal Server Working
```bash
node fix-railway.js minimal
railway up
# Test: https://your-app.railway.app/health
```

### Phase 2: Verify Database
```bash
# Visit: https://your-app.railway.app/db-test
# Should return: {"status": "Database connected successfully"}
```

### Phase 3: Switch to Full Server
```bash
node fix-railway.js full
railway up
# Test: https://your-app.railway.app/admin
# Test: https://your-app.railway.app/api-docs
```

## Debugging Commands

```bash
# Check Railway logs
railway logs

# Check Railway status
railway status

# Check environment variables
railway variables

# Redeploy
railway up

# Test endpoints
curl https://aekobackend-production.up.railway.app/health
curl https://aekobackend-production.up.railway.app/db-test
```

## Common Error Solutions

### Error: "MONGO_URI not set"
**Solution**: Add MONGO_URI to Railway environment variables

### Error: "Database connection failed"
**Solution**: 
1. Check MongoDB Atlas IP whitelist
2. Verify database user permissions
3. Test connection string format

### Error: "Module not found"
**Solution**: 
1. Use minimal server first
2. Check package.json dependencies
3. Verify all imported files exist

### Error: "Port already in use"
**Solution**: Railway handles ports automatically, ensure you use `process.env.PORT`

## Success Indicators

✅ **Minimal Server Working**: `/health` returns 200 OK
✅ **Database Connected**: `/db-test` returns success
✅ **Full Server Working**: `/admin` and `/api-docs` accessible
✅ **No 502 Errors**: All endpoints respond correctly

## Emergency Contacts

If you're still getting 502 errors after trying minimal server:

1. **Check Railway logs** for specific error messages
2. **Verify all environment variables** are set correctly
3. **Test MongoDB connection** separately
4. **Use debug server** for detailed diagnostics

The minimal server should work immediately if environment variables are correct!