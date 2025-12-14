# 🚨 EMERGENCY RAILWAY FIX

## Your app is not starting at all. Here's the immediate fix:

### Step 1: Check Railway Logs (CRITICAL)
```bash
railway logs
```
Look for the exact error message when the app tries to start.

### Step 2: Verify Start Command
In Railway Dashboard:
1. Go to Settings → Deploy
2. Check "Start Command" - should be: `npm start`
3. Or check if there's a custom start command set

### Step 3: Check Environment Variables
In Railway Dashboard → Variables, ensure these exist:
```
NODE_ENV=production
PORT (Railway sets this automatically - don't override)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_jwt_secret_here
```

### Step 4: Emergency Minimal Server
If logs show import errors, create this ultra-minimal server:

Create `emergency-server.js`:
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Emergency server working', port: PORT });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Emergency server running on port ${PORT}`);
});
```

Then update package.json:
```json
{
  "scripts": {
    "start": "node emergency-server.js"
  }
}
```

### Step 5: Common Issues & Fixes

**Issue: "Cannot find module"**
- Solution: Missing dependencies or wrong import paths

**Issue: "MONGO_URI not defined"**  
- Solution: Add MONGO_URI to Railway environment variables

**Issue: "Port already in use"**
- Solution: Don't set PORT in environment variables (Railway handles this)

**Issue: "Syntax error"**
- Solution: Use CommonJS (require) instead of ES modules temporarily

### Step 6: Test Locally First
```bash
# Test the minimal server locally
node minimal-server.js

# Should show: "Minimal server running on port 9876"
# Test: http://localhost:9876/health
```

### Step 7: Railway Deployment Commands
```bash
# Check current deployment
railway status

# View logs in real-time
railway logs --follow

# Force redeploy
railway up --detach

# Check environment variables
railway variables
```

## Most Likely Causes:

1. **Missing Environment Variables** (90% chance)
2. **Import/Module Errors** (ES6 vs CommonJS)
3. **Database Connection Blocking Startup**
4. **Port Configuration Issues**

## Quick Test:
Run `railway logs` and look for:
- "Error: Cannot find module"
- "MONGO_URI is not defined" 
- "Port 5000 is already in use"
- Any other specific error messages

Share the exact error from the logs and I can give you the precise fix!