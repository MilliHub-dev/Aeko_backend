/**
 * Google OAuth Configuration Test Script
 * 
 * This script checks if your Google OAuth is properly configured
 * Run with: node test-google-oauth.js
 */

import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

console.log('\n🔍 Testing Google OAuth Configuration...\n');

// Check environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'OAUTH_SUCCESS_REDIRECT',
  'OAUTH_FAILURE_REDIRECT',
  'JWT_SECRET'
];

let allEnvVarsPresent = true;

console.log('📋 Checking Environment Variables:\n');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value !== `your_${varName.toLowerCase()}_here`) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing or not configured`);
    allEnvVarsPresent = false;
  }
});

if (!allEnvVarsPresent) {
  console.log('\n⚠️  Some environment variables are missing or not configured.');
  console.log('Please update your .env file with the correct values.\n');
  console.log('See docs/GOOGLE_OAUTH_SETUP_GUIDE.md for instructions.\n');
  process.exit(1);
}

// Test OAuth2Client initialization
console.log('\n🔧 Testing OAuth2Client Initialization:\n');
try {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
  console.log('✅ OAuth2Client initialized successfully');
  
  // Display configuration
  console.log('\n📝 Current Configuration:\n');
  console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`);
  console.log(`   Callback URL: ${process.env.GOOGLE_CALLBACK_URL}`);
  console.log(`   Success Redirect: ${process.env.OAUTH_SUCCESS_REDIRECT}`);
  console.log(`   Failure Redirect: ${process.env.OAUTH_FAILURE_REDIRECT}`);
  
} catch (error) {
  console.log('❌ Failed to initialize OAuth2Client');
  console.log(`   Error: ${error.message}`);
  process.exit(1);
}

// Check callback URL format
console.log('\n🔗 Validating Callback URL:\n');
const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
if (callbackUrl.startsWith('http://') || callbackUrl.startsWith('https://')) {
  console.log('✅ Callback URL has valid protocol');
} else {
  console.log('❌ Callback URL missing protocol (http:// or https://)');
}

if (callbackUrl.includes('/api/auth/google/callback')) {
  console.log('✅ Callback URL has correct path');
} else {
  console.log('⚠️  Callback URL path might be incorrect');
  console.log('   Expected: /api/auth/google/callback');
}

// Check redirect URLs
console.log('\n🔄 Validating Redirect URLs:\n');
const successUrl = process.env.OAUTH_SUCCESS_REDIRECT;
const failureUrl = process.env.OAUTH_FAILURE_REDIRECT;

if (successUrl.startsWith('http://') || successUrl.startsWith('https://')) {
  console.log('✅ Success redirect URL has valid protocol');
} else {
  console.log('❌ Success redirect URL missing protocol');
}

if (failureUrl.startsWith('http://') || failureUrl.startsWith('https://')) {
  console.log('✅ Failure redirect URL has valid protocol');
} else {
  console.log('❌ Failure redirect URL missing protocol');
}

// Final summary
console.log('\n' + '='.repeat(60));
console.log('📊 Configuration Test Summary');
console.log('='.repeat(60) + '\n');

if (allEnvVarsPresent) {
  console.log('✅ All environment variables are configured');
  console.log('✅ OAuth2Client can be initialized');
  console.log('\n🎉 Your Google OAuth configuration looks good!\n');
  console.log('Next steps:');
  console.log('1. Make sure these URLs are added to Google Cloud Console:');
  console.log(`   - Authorized redirect URI: ${callbackUrl}`);
  console.log(`   - Authorized JavaScript origin: ${new URL(callbackUrl).origin}`);
  console.log('\n2. Start your server: npm run dev');
  console.log('3. Test the OAuth flow by visiting: /api/auth/google\n');
  console.log('📖 For detailed setup instructions, see:');
  console.log('   docs/GOOGLE_OAUTH_SETUP_GUIDE.md\n');
} else {
  console.log('❌ Configuration incomplete');
  console.log('\n📖 Please see docs/GOOGLE_OAUTH_SETUP_GUIDE.md for setup instructions.\n');
  process.exit(1);
}
