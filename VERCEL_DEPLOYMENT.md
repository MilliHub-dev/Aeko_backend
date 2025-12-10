# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a cloud MongoDB database at [mongodb.com/atlas](https://mongodb.com/atlas)
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Prepare Your Database

1. Create a MongoDB Atlas cluster
2. Get your connection string (should look like: `mongodb+srv://username:password@cluster.mongodb.net/aeko_db`)
3. Whitelist all IP addresses (0.0.0.0/0) for Vercel's serverless functions

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Node.js project

### Option B: Deploy via Vercel CLI
```bash
npm i -g vercel
vercel login
vercel
```

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to Settings > Environment Variables and add:

### Required Variables:
```
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
JWT_SECRET=your_strong_jwt_secret_here
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### CRITICAL: MongoDB Atlas Setup
1. Create MongoDB Atlas account at https://mongodb.com/atlas
2. Create a new cluster
3. Go to Database Access → Add Database User
4. Go to Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)
5. Get connection string from Connect → Connect your application
6. Replace `<password>` with your database user password
7. Replace `<dbname>` with `aeko_db`

### OAuth Configuration:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-backend-domain.vercel.app/api/auth/google/callback
OAUTH_SUCCESS_REDIRECT=https://your-frontend-domain.vercel.app/auth/success
OAUTH_FAILURE_REDIRECT=https://your-frontend-domain.vercel.app/auth/failed
```

### Third-party Services:
```
OPENAI_API_KEY=your_openai_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Blockchain Configuration:
```
CONTRACT_ADDRESS=0x7216778551085922af4Ae96d5c92B2B2bc9AFf7b
PRIVATE_KEY=your_private_key
POLYGON_ZKEVM_RPC=sepolia.infura.io:11155111
```

### Other Services:
```
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET=your_pinata_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
AEKO_WALLET_ADMIN_FEE_PERCENTAGE=5
DEFAULT_CURRENCY=USD
PAYMENT_METHODS=paystack,stripe,aeko_wallet
```

## Step 4: Update Your Frontend

Update your frontend to point to your new Vercel backend URL:
```javascript
const API_BASE_URL = 'https://your-backend-domain.vercel.app/api';
```

## Step 5: Test Your Deployment

1. **Landing Page**: `https://your-app.vercel.app/` (Beautiful HTML page with project info)
2. **API Info**: `https://your-app.vercel.app/api` (JSON response with API details)
3. **Project Info**: `https://your-app.vercel.app/api/info` (Detailed feature information)
4. **Health Check**: `https://your-app.vercel.app/api/health` (System status with database)
5. **Available Routes**: `https://your-app.vercel.app/api/routes` (Loaded routes status)
6. **Swagger Documentation**: `https://your-app.vercel.app/api-docs` (Interactive API docs)
7. **API Spec JSON**: `https://your-app.vercel.app/api-docs.json` (OpenAPI specification)

### Test Endpoints:
- Auth: `https://your-app.vercel.app/api/auth/*`
- Users: `https://your-app.vercel.app/api/users`
- Posts: `https://your-app.vercel.app/api/posts`
- Profile: `https://your-app.vercel.app/api/profile`

## Important Notes

### Vercel Limitations:
- **Serverless Functions**: Each API call runs in a serverless function
- **Cold Starts**: First request might be slower
- **Timeout**: Functions timeout after 10s (Hobby) or 60s (Pro)
- **File Uploads**: Use cloud storage (Cloudinary) instead of local storage

### Database Considerations:
- Use MongoDB Atlas (cloud) instead of local MongoDB
- Connection pooling is handled automatically
- Consider connection limits on your MongoDB plan

### File Storage:
- Vercel doesn't support persistent file storage
- All file uploads should go to Cloudinary (already configured)
- Remove any local file storage logic

## Troubleshooting

### Common Issues:

1. **Environment Variables**: Make sure all required env vars are set in Vercel
2. **Database Connection**: Ensure MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
3. **CORS Issues**: Update CORS settings to include your Vercel domain
4. **Function Timeout**: Optimize slow database queries
5. **Cold Starts**: Consider using Vercel Pro for better performance

### Logs:
- Check function logs in Vercel dashboard
- Use `console.log` for debugging (visible in Vercel function logs)

## Custom Domain (Optional)

1. Go to your Vercel project settings
2. Add your custom domain
3. Update DNS records as instructed
4. Update all environment variables with new domain

## Continuous Deployment

Vercel automatically deploys when you push to your main branch. To deploy:

```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

Your app will be live at: `https://your-project-name.vercel.app`