/**
 * Test script for OAuth deep link and get all users functionality
 * Run with: node test-oauth-deeplink.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testGetAllUsers() {
    console.log('\n🧪 Testing GET /api/users endpoint...');
    
    try {
        // You'll need a valid JWT token to test this endpoint
        const token = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token
        
        const response = await fetch(`${BASE_URL}/api/users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Get all users successful');
            console.log(`📊 Found ${data.users.length} users`);
            console.log(`📄 Page ${data.pagination.currentPage} of ${data.pagination.totalPages}`);
            console.log('👥 Sample users:', data.users.slice(0, 3).map(u => ({ 
                username: u.username, 
                name: u.name,
                blueTick: u.blueTick 
            })));
        } else {
            console.log('❌ Get all users failed:', data.message);
        }
    } catch (error) {
        console.log('❌ Error testing get all users:', error.message);
    }
}

async function testMobileOAuth() {
    console.log('\n🧪 Testing mobile OAuth deep link...');
    
    try {
        // This is a mock test - in real usage, you'd get the idToken from Google SDK
        const mockData = {
            idToken: 'MOCK_ID_TOKEN', // This would be a real Google ID token
            user: {
                name: 'Test User',
                email: 'test@example.com',
                photo: 'https://example.com/photo.jpg'
            }
        };
        
        const response = await fetch(`${BASE_URL}/api/auth/google/mobile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mockData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Mobile OAuth response structure correct');
            console.log('🔗 Deep link format:', data.deepLink);
            console.log('🎯 Deep link matches expected pattern:', 
                data.deepLink && data.deepLink.startsWith('aeko://home?token='));
        } else {
            console.log('ℹ️  Expected failure with mock token:', data.message);
            console.log('📝 This is normal - use real Google ID token for actual testing');
        }
    } catch (error) {
        console.log('❌ Error testing mobile OAuth:', error.message);
    }
}

function showDeepLinkInfo() {
    console.log('\n📱 Deep Link Implementation Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 Deep Link Format: aeko://home?token=YOUR_JWT_TOKEN');
    console.log('📍 OAuth Callback: /api/auth/google/callback');
    console.log('📱 Mobile OAuth: /api/auth/google/mobile');
    console.log('👥 Get All Users: GET /api/users');
    console.log('');
    console.log('✨ Features implemented:');
    console.log('  • Google OAuth redirects to deep link');
    console.log('  • Mobile OAuth returns deep link in response');
    console.log('  • Regular login includes deep link');
    console.log('  • Email verification includes deep link');
    console.log('  • Get all users with pagination and search');
    console.log('  • Privacy-aware user filtering');
}

async function main() {
    console.log('🚀 Testing OAuth Deep Link & User Endpoints');
    console.log('═══════════════════════════════════════════════');
    
    showDeepLinkInfo();
    await testMobileOAuth();
    await testGetAllUsers();
    
    console.log('\n✅ Testing complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Replace YOUR_JWT_TOKEN_HERE with a real token to test /api/users');
    console.log('  2. Test OAuth flow with real Google credentials');
    console.log('  3. Verify deep link handling in your mobile app');
}

main().catch(console.error);