#!/bin/bash

# Railway Deployment Script for Aeko Backend
echo "🚀 Preparing Aeko Backend for Railway Deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for Railway deployment"
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
railway login

# Create new project or link existing
echo "🔗 Linking to Railway project..."
railway link

# Set essential environment variables
echo "⚙️  Setting up environment variables..."
echo "Please set the following environment variables in Railway dashboard:"
echo ""
echo "Essential Variables:"
echo "- NODE_ENV=production"
echo "- MONGO_URI=your_mongodb_atlas_connection_string"
echo "- JWT_SECRET=your_jwt_secret"
echo "- FRONTEND_URL=your_frontend_domain"
echo ""
echo "Visit your Railway dashboard to add these variables."
echo ""

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo "📊 Check your Railway dashboard for deployment status"
echo "🌐 Your app will be available at: https://your-app-name.railway.app"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Railway dashboard"
echo "2. Test your deployment endpoints"
echo "3. Update your frontend to use the new Railway URL"
echo ""
echo "Happy deploying! 🎉"