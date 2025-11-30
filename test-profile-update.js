/**
 * Test Script for /api/profile/update endpoint
 * 
 * Usage: node test-profile-update.js
 */

const BASE_URL = 'http://localhost:5000';

// UPDATE THESE WITH YOUR CREDENTIALS
const TEST_EMAIL = 'abdul1.olushola1@gmail.com';
const TEST_PASSWORD = '14028olu';

async function testProfileUpdate() {
  console.log('🚀 Testing /api/profile and /api/profile/update endpoints\n');
  
  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
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
    
    if (!loginResponse.ok || !loginData.token) {
      console.log('❌ Login failed:', loginData.message);
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Login successful!');
    console.log('Token:', token.substring(0, 30) + '...');
    console.log('User:', loginData.user.username);
    console.log('');
    
    // Step 2: Get current profile
    console.log('Step 2: Getting current profile...');
    const getProfileResponse = await fetch(`${BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const profileData = await getProfileResponse.json();
    
    if (!getProfileResponse.ok) {
      console.log('❌ Get profile failed!');
      console.log('Status:', getProfileResponse.status);
      console.log('Response:', JSON.stringify(profileData, null, 2));
      return;
    }
    
    console.log('✅ Get profile successful!');
    console.log('Current bio:', profileData.user.bio || '(empty)');
    console.log('');
    
    // Step 3: Update profile
    console.log('Step 3: Updating profile...');
    const newBio = `Updated bio at ${new Date().toISOString()}`;
    
    const updateResponse = await fetch(`${BASE_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bio: newBio
      })
    });
    
    const updateData = await updateResponse.json();
    
    console.log('Status:', updateResponse.status);
    console.log('Response:', JSON.stringify(updateData, null, 2));
    
    if (updateResponse.ok) {
      console.log('\n✅ SUCCESS! Profile update is working!');
      console.log('New bio:', updateData.user.bio);
    } else {
      console.log('\n❌ FAILED! Profile update returned an error');
      
      // Check if it's a 2FA requirement
      if (updateData.message && updateData.message.includes('2FA')) {
        console.log('\n⚠️  Note: This endpoint requires 2FA verification');
        console.log('If you have 2FA enabled, you need to provide the x-2fa-token header');
      }
    }
    
    // Step 4: Verify the update
    console.log('\nStep 4: Verifying the update...');
    const verifyResponse = await fetch(`${BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const verifyData = await verifyResponse.json();
    
    if (verifyResponse.ok) {
      console.log('✅ Verification successful!');
      console.log('Current bio:', verifyData.user.bio);
      
      if (verifyData.user.bio === newBio) {
        console.log('✅ Bio was updated correctly!');
      } else {
        console.log('⚠️  Bio might not have been updated');
      }
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
testProfileUpdate();
