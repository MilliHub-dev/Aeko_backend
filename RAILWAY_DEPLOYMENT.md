# Railway Deployment Guide

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **MongoDB Atlas**: Set up a cloud MongoDB database at [mongodb.com/atlas](https://mongodb.com/atlas)
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Prepare MongoDB Atlas

1. Create a MongoDB Atlas cluster
2. Get your connection string (should look like: `mongodb+srv://username:password@cluster.mongodb.net/aeko_db`)
3. Whitelist all IP addresses (0.0.0.0/0) for Railway's dynamic IPs

## Step 2: Deploy to Railway

### Option A: Deploy via Railway Dashboard
1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select your repository
5. Railway will auto-detect it's a Node.js project

### Option B: Deploy via Railway CLI
```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

## Step 3: Configure Environment Variables

In your Railway project dashboard, go to Variables tab and add:

### Required Variables:
```env
# Server Configuration
PORT=9876
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_strong_jwt_secret_here
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-railway-domain.railway.app/api/auth/google/callback
OAUTH_SUCCESS_REDIRECT=https://your-frontend-domain.com/auth/success
OAUTH_FAILURE_REDIRECT=https://your-frontend-domain.com/auth/failed

# Blockchain Configuration
CONTRACT_ADDRESS=your_contract_address
PRIVATE_KEY=your_private_key
POLYGON_ZKEVM_RPC=your_rpc_url

# Solana Configuration
SOLANA_NETWORK=mainnet-beta
SOLANA_PRIVATE_KEY=your_solana_private_key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# IPFS Configuration
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET=your_pinata_secret

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Payment Gateways
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# App Settings
AEKO_WALLET_ADMIN_FEE_PERCENTAGE=5
DEFAULT_CURRENCY=USD
PAYMENT_METHODS=paystack,stripe,aeko_wallet
```

## Step 4: Update Your Frontend

Update your frontend to point to your new Railway backend URL:

```javascript
const API_BASE_URL = 'https://your-app-name.railway.app/api';
```

## Step 5: Test Your Deployment

1. **Landing Page**: `https://your-app.railway.app/` (Beautiful HTML page with project info)
2. **API Info**: `https://your-app.railway.app/api` (JSON response with API details)
3. **Health Check**: `https://your-app.railway.app/api/health` (System status with database)
4. **Swagger Documentation**: `https://your-app.railway.app/api-docs` (Interactive API docs)
5. **Admin Panel**: `https://your-app.railway.app/admin` (AdminJS dashboard)

### 🔧 Admin Panel Access
- **URL**: `https://your-app.railway.app/admin`
- **Login**: Use admin credentials (create admin user first)
- **Features**: User management, content moderation, analytics, blockchain monitoring

### 📚 API Documentation
- **Swagger UI**: `https://your-app.railway.app/api-docs`
- **OpenAPI Spec**: `https://your-app.railway.app/api-docs.json`
- **Features**: Interactive API testing, complete endpoint documentation

### Test Endpoints:
- Auth: `https://your-app.railway.app/api/auth/*`
- Users: `https://your-app.railway.app/api/users`
- Posts: `https://your-app.railway.app/api/posts`
- Profile: `https://your-app.railway.app/api/profile`

### 👤 Create First Admin User

After deployment, create your first admin user:

```bash
# Method 1: API Endpoint (No auth required for first admin)
curl -X POST https://your-app.railway.app/api/admin/setup/first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "your-secure-password"
  }'

# Method 2: Register normal user, then promote via database
# 1. Register: POST /api/auth/register
# 2. Update user in admin panel or database: { isAdmin: true }
```

**Default Admin Credentials** (if using create-admin.js script):
- Email: `admin@aeko.com`
- Password: `admin123`
- **⚠️ Change these immediately after first login!**

## Railway Advantages

### Why Railway is Great:
- **Easy Deployment**: Git-based deployments
- **Auto-scaling**: Handles traffic spikes automatically
- **Built-in Monitoring**: Logs, metrics, and alerts
- **Custom Domains**: Easy SSL setup
- **Database Support**: Built-in PostgreSQL, Redis, etc.
- **Fair Pricing**: Pay for what you use

### Railway Features:
- Automatic HTTPS certificates
- Environment variable management
- Deployment rollbacks
- Branch deployments
- Team collaboration

## Important Notes

### File Storage:
- Railway supports persistent storage with volumes
- For better performance, use Cloudinary for file uploads (already configured)
- Consider Railway's volume storage for temporary files

### Database:
- Use MongoDB Atlas for production (recommended)
- Railway also offers PostgreSQL if you want to switch databases
- Ensure your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0)

### Performance:
- Railway automatically handles scaling
- Consider upgrading to Pro plan for better performance
- Monitor your app's resource usage in Railway dashboard

### Common Issues:

1. **Environment Variables**: Make sure all required env vars are set in Railway
2. **Database Connection**: Ensure MongoDB Atlas allows connections from anywhere
3. **CORS Issues**: Update CORS settings to include your Railway domain
4. **Port Configuration**: Railway automatically assigns PORT, but your app uses process.env.PORT || 9876

### Logs:
- Check deployment logs in Railway dashboard
- Use `railway logs` CLI command for real-time logs
- Set up log alerts for errors

## Custom Domain Setup

1. Go to your Railway project settings
2. Click on "Domains"
3. Add your custom domain
4. Update your DNS records as instructed
5. Railway will automatically provision SSL certificates

## Deployment Commands

```bash
# Deploy current branch
railway up

# Deploy specific service
railway up --service backend

# Check deployment status
railway status

# View logs
railway logs

# Open deployed app
railway open
```

## Environment Management

```bash
# Set environment variable
railway variables set KEY=value

# List all variables
railway variables

# Delete variable
railway variables delete KEY
```

## Monitoring & Scaling

- Monitor resource usage in Railway dashboard
- Set up alerts for high CPU/memory usage
- Railway automatically scales based on traffic
- Consider upgrading plan for better performance

Your Aeko backend will be live and scalable on Railway! 🚀