/**
 * Test Script for Authentication Endpoints
 * 
 * This script helps test the authentication fixes for:
 * 1. Google OAuth sync with email/password auth
 * 2. Profile endpoints authentication
 * 3. Repost endpoint
 * 4. Users endpoint
 * 
 * Usage:
 * 1. Update the BASE_URL if needed
 * 2. Run: node test-auth-endpoints.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

// Test data
let authToken = '';
let userId = '';
let testPostId = '';

// Helper function to make requests
async function makeRequest(method, endpoint, data = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return { status: response.status, data: result };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Test functions
async function testEmailLogin() {
  console.log('\n=== Testing Email/Password Login ===');
  const result = await makeRequest('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (result.status === 200 && result.data.token) {
    authToken = result.data.token;
    userId = result.data.user._id;
    console.log('✅ Email login successful');
    console.log('Token:', authToken.substring(0, 20) + '...');
    return true;
  } else {
    console.log('❌ Email login failed:', result.data.message || result.error);
    return false;
  }
}

async function testGetProfile() {
  console.log('\n=== Testing GET /api/profile ===');
  const result = await makeRequest('GET', '/api/profile', null, authToken);
  
  if (result.status === 200 && result.data.success) {
    console.log('✅ Profile retrieved successfully');
    console.log('User:', result.data.user.username);
    return true;
  } else {
    console.log('❌ Profile retrieval failed:', result.data.error || result.error);
    return false;
  }
}

async function testUpdateProfile() {
  console.log('\n=== Testing PUT /api/profile/update ===');
  const result = await makeRequest('PUT', '/api/profile/update', {
    bio: 'Updated bio - ' + new Date().toISOString()
  }, authToken);
  
  if (result.status === 200 && result.data.success) {
    console.log('✅ Profile updated successfully');
    return true;
  } else {
    console.log('❌ Profile update failed:', result.data.error || result.error);
    return false;
  }
}

async function testGetUsers() {
  console.log('\n=== Testing GET /api/users ===');
  const result = await makeRequest('GET', '/api/users', null, authToken);
  
  if (result.status === 200 && result.data.success) {
    console.log('✅ Users list retrieved successfully');
    console.log('Total users:', result.data.pagination.totalUsers);
    return true;
  } else {
    console.log('❌ Users list failed:', result.data.error || result.error);
    return false;
  }
}

async function testCreatePost() {
  console.log('\n=== Testing POST /api/posts (Create Post) ===');
  const result = await makeRequest('POST', '/api/posts', {
    text: 'Test post for repost - ' + new Date().toISOString(),
    type: 'text'
  }, authToken);
  
  if (result.status === 201 && result._id) {
    testPostId = result._id;
    console.log('✅ Post created successfully');
    console.log('Post ID:', testPostId);
    return true;
  } else {
    console.log('❌ Post creation failed:', result.error || result.message);
    return false;
  }
}

async function testRepost() {
  console.log('\n=== Testing POST /api/posts/repost/:postId ===');
  
  if (!testPostId) {
    console.log('⚠️  Skipping repost test - no post ID available');
    return false;
  }
  
  const result = await makeRequest('POST', `/api/posts/repost/${testPostId}`, {}, authToken);
  
  if (result.status === 201 && result.data._id) {
    console.log('✅ Repost created successfully');
    console.log('Repost ID:', result.data._id);
    return true;
  } else {
    console.log('❌ Repost failed:', result.data.error || result.error);
    return false;
  }
}

async function testGoogleOAuthCallback() {
  console.log('\n=== Testing Google OAuth (Manual) ===');
  console.log('⚠️  Google OAuth requires manual testing:');
  console.log('1. Navigate to: ' + BASE_URL + '/api/auth/google');
  console.log('2. Complete Google OAuth flow');
  console.log('3. Check if you receive a token in the deep link');
  console.log('4. Test the same endpoints with the OAuth token');
  return true;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Authentication Tests');
  console.log('Base URL:', BASE_URL);
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  // Test email login
  if (await testEmailLogin()) {
    results.passed++;
    
    // Test profile endpoints
    if (await testGetProfile()) results.passed++; else results.failed++;
    if (await testUpdateProfile()) results.passed++; else results.failed++;
    
    // Test users endpoint
    if (await testGetUsers()) results.passed++; else results.failed++;
    
    // Test post creation and repost
    if (await testCreatePost()) {
      results.passed++;
      if (await testRepost()) results.passed++; else results.failed++;
    } else {
      results.failed++;
      results.skipped++;
    }
  } else {
    results.failed++;
    console.log('\n⚠️  Skipping remaining tests due to login failure');
    console.log('Please ensure:');
    console.log('1. Server is running at', BASE_URL);
    console.log('2. Test user exists (email: test@example.com, password: password123)');
    console.log('3. Database is connected');
  }
  
  // OAuth test info
  await testGoogleOAuthCallback();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log('✅ Passed:', results.passed);
  console.log('❌ Failed:', results.failed);
  console.log('⏭️  Skipped:', results.skipped);
  console.log('='.repeat(50));
  
  if (results.failed === 0 && results.passed > 0) {
    console.log('\n🎉 All tests passed!');
  } else if (results.failed > 0) {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run tests
runTests().catch(console.error);
