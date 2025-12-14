# 🚨 Railway 502 Error - Quick Fix Guide

## Immediate Actions

### Step 1: Use Minimal Server
1. **Change start command in Railway**:
   - Go to Railway Dashboard → Your Project → Settings
   - Change start command to: `npm run start:minimal`
   - Or add environment variable: `START_COMMAND=npm run start:minimal`

2. **Deploy minimal server**:
   ```bash
   railway up
   ```

3. **Test minimal endpoints**:
   - `https://aekobackend-production.up.railway.app/health`
   - `https://aekobackend-production.up.railway.app/db-test`

### Step 2: Check Environment Variables
Ensure these are set in Railway Dashboard → Variables:

**Required:**
```
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_jwt_secret_here
```

**Optional (for testing):**
```
FRONTEND_URL=https://your-frontend.com
```

### Step 3: Test Database Connection
Visit: `https://aekobackend-production.up.railway.app/db-test`

If it fails:
1. Check MongoDB Atlas IP whitelist (set to 0.0.0.0/0)
2. Verify database user permissions
3. Test MONGO_URI format

## Common Issues & Solutions

### Issue 1: Environment Variables Missing
**Symptoms**: 502 error, app won't start
**Solution**: Add all required env vars in Railway dashboard

### Issue 2: MongoDB Connection Failed
**Symptoms**: App starts but /db-test fails
**Solution**: 
- Whitelist all IPs in MongoDB Atlas
- Check database user permissions
- Verify connection string format

### Issue 3: Import/Dependency Errors
**Symptoms**: 502 error with import failures in logs
**Solution**: Use minimal server first, then gradually add features

### Issue 4: Memory/Resource Limits
**Symptoms**: App starts then crashes
**Solution**: Optimize imports, use Railway Pro plan

## Testing Commands

```bash
# Check Railway logs
railway logs

# Test minimal server locally
npm run start:minimal

# Test specific endpoints
curl https://aekobackend-production.up.railway.app/health
curl https://aekobackend-production.up.railway.app/db-test
```

## Recovery Steps

1. **Get minimal server working first**
2. **Verify database connection**
3. **Add environment variables**
4. **Switch back to full server**: Change start command to `npm start`
5. **Test admin and swagger**: `/admin` and `/api-docs`

## Emergency Contact
If minimal server works but full server fails, the issue is likely:
- Missing environment variables
- Database connection problems
- Import/dependency conflicts
- Memory limits

Check Railway logs for specific error messages!