# Railway Deployment Checklist

## Pre-Deployment Setup

### ✅ 1. MongoDB Atlas Setup
- [ ] Create MongoDB Atlas account
- [ ] Create a new cluster
- [ ] Create database user with read/write permissions
- [ ] Whitelist all IP addresses (0.0.0.0/0)
- [ ] Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/aeko_db`

### ✅ 2. External Services Setup
- [ ] **Cloudinary**: Get cloud name, API key, and API secret
- [ ] **Google OAuth**: Set up OAuth app and get client ID/secret
- [ ] **Pinata (IPFS)**: Get API key and secret
- [ ] **OpenAI**: Get API key
- [ ] **Payment Gateways**: Set up Paystack, Stripe, Flutterwave accounts
- [ ] **Email Service**: Set up Gmail app password or SMTP service

### ✅ 3. Code Preparation
- [x] Update PORT configuration (✅ Done)
- [x] Configure CORS for Railway domains (✅ Done)
- [x] Create railway.json configuration (✅ Done)
- [x] Create Procfile (✅ Done)
- [x] Ensure start script in package.json (✅ Done)

## Railway Deployment Steps

### ✅ 4. Deploy to Railway
1. **Create Railway Account**
   - [ ] Sign up at [railway.app](https://railway.app)
   - [ ] Connect your GitHub account

2. **Deploy Project**
   - [ ] Push code to GitHub repository
   - [ ] Create new project in Railway
   - [ ] Connect GitHub repository
   - [ ] Railway will auto-detect Node.js and deploy

3. **Configure Environment Variables**
   Copy these variables to Railway dashboard:

   ```env
   # Essential Variables
   NODE_ENV=production
   PORT=9876
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/aeko_db
   JWT_SECRET=your_strong_jwt_secret_here
   FRONTEND_URL=https://your-frontend-domain.com

   # OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=https://your-railway-app.railway.app/api/auth/google/callback
   OAUTH_SUCCESS_REDIRECT=https://your-frontend-domain.com/auth/success
   OAUTH_FAILURE_REDIRECT=https://your-frontend-domain.com/auth/failed

   # File Storage
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret

   # IPFS
   PINATA_API_KEY=your_pinata_api_key
   PINATA_SECRET=your_pinata_secret

   # AI
   OPENAI_API_KEY=your_openai_api_key

   # Blockchain
   CONTRACT_ADDRESS=your_contract_address
   PRIVATE_KEY=your_private_key
   SOLANA_NETWORK=mainnet-beta
   SOLANA_PRIVATE_KEY=your_solana_private_key
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

   # Email
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

   # App Settings
   AEKO_WALLET_ADMIN_FEE_PERCENTAGE=5
   DEFAULT_CURRENCY=USD
   PAYMENT_METHODS=paystack,stripe,aeko_wallet
   ```

## Post-Deployment Testing

### ✅ 5. Test Deployment
- [ ] **Health Check**: `https://your-app.railway.app/api/health`
- [ ] **API Info**: `https://your-app.railway.app/api`
- [ ] **Swagger Docs**: `https://your-app.railway.app/api-docs`
- [ ] **Database Connection**: Check health endpoint shows DB connected
- [ ] **Authentication**: Test login/register endpoints
- [ ] **File Upload**: Test image upload (should use Cloudinary)

### ✅ 6. Frontend Integration
- [ ] Update frontend API base URL to Railway domain
- [ ] Test OAuth login flow
- [ ] Test all major features
- [ ] Update any hardcoded localhost URLs

### ✅ 7. Domain & SSL (Optional)
- [ ] Add custom domain in Railway settings
- [ ] Update DNS records
- [ ] Verify SSL certificate is active
- [ ] Update environment variables with new domain

## Monitoring & Maintenance

### ✅ 8. Set Up Monitoring
- [ ] Check Railway dashboard for metrics
- [ ] Set up log alerts for errors
- [ ] Monitor database performance
- [ ] Set up uptime monitoring (optional)

### ✅ 9. Security Checklist
- [ ] All environment variables are set correctly
- [ ] No sensitive data in code repository
- [ ] CORS is properly configured
- [ ] Rate limiting is active
- [ ] HTTPS is enforced

## Troubleshooting

### Common Issues:
1. **Build Fails**: Check package.json and dependencies
2. **App Crashes**: Check Railway logs for errors
3. **Database Connection**: Verify MongoDB Atlas IP whitelist
4. **CORS Errors**: Update CORS configuration
5. **Environment Variables**: Double-check all required vars are set

### Useful Commands:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# View logs
railway logs

# Deploy current branch
railway up

# Check status
railway status
```

## Success Criteria

Your deployment is successful when:
- [ ] ✅ App builds and deploys without errors
- [ ] ✅ Health check endpoint returns 200 OK
- [ ] ✅ Database connection is established
- [ ] ✅ Authentication endpoints work
- [ ] ✅ File uploads work (via Cloudinary)
- [ ] ✅ All major API endpoints respond correctly
- [ ] ✅ Frontend can communicate with backend
- [ ] ✅ OAuth login flow works end-to-end

🎉 **Congratulations! Your Aeko backend is now live on Railway!**