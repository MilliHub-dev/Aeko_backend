/**
 * Quick Test Script for /api/profile endpoint
 * 
 * Usage: node test-profile-endpoint.js
 */

const BASE_URL = 'http://localhost:5000';

// UPDATE THESE WITH YOUR CREDENTIALS
const TEST_EMAIL = 'abdul1.olushola1@gmail.com'; // Change this
const TEST_PASSWORD = '14028olu'; // Change this

async function testProfile() {
  console.log('🚀 Testing /api/profile endpoint\n');
  
  // Step 1: Login
  console.log('Step 1: Logging in...');
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginData.message);
      console.log('Response:', JSON.stringify(loginData, null, 2));
      return;
    }
    
    if (!loginData.token) {
      console.log('❌ No token received');
      console.log('Response:', JSON.stringify(loginData, null, 2));
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Login successful!');
    console.log('Token:', token.substring(0, 30) + '...');
    console.log('User:', loginData.user.username);
    console.log('');
    
    // Step 2: Test /api/profile
    console.log('Step 2: Testing /api/profile...');
    const profileResponse = await fetch(`${BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const profileData = await profileResponse.json();
    
    console.log('Status:', profileResponse.status);
    console.log('Response:', JSON.stringify(profileData, null, 2));
    
    if (profileResponse.ok) {
      console.log('\n✅ SUCCESS! Profile endpoint is working!');
    } else {
      console.log('\n❌ FAILED! Profile endpoint returned an error');
      console.log('Check the server console for detailed logs');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('\nMake sure:');
    console.log('1. Server is running on port 5000');
    console.log('2. Your credentials are correct');
    console.log('3. Database is connected');
  }
}

// Run the test
testProfile();
