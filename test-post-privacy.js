import axios from 'axios';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:5000';

// Test function to create posts with different privacy levels
async function testPostCreationWithPrivacy() {
  console.log('🧪 Testing Post Creation with Privacy Controls\n');

  // You'll need to replace this with a valid JWT token from your system
  const authToken = 'your-jwt-token-here';
  
  const headers = {
    'Authorization': `Bearer ${authToken}`,
  };

  try {
    // Test 1: Create a public post
    console.log('📝 Test 1: Creating public post...');
    const publicPostData = new FormData();
    publicPostData.append('text', 'This is a public post');
    publicPostData.append('type', 'text');
    publicPostData.append('privacy', 'public');

    const publicResponse = await axios.post(`${BASE_URL}/api/posts/create`, publicPostData, {
      headers: { ...headers, ...publicPostData.getHeaders() }
    });
    console.log('✅ Public post created:', publicResponse.data.privacy);

    // Test 2: Create a followers-only post
    console.log('\n📝 Test 2: Creating followers-only post...');
    const followersPostData = new FormData();
    followersPostData.append('text', 'This is a followers-only post');
    followersPostData.append('type', 'text');
    followersPostData.append('privacy', 'followers');

    const followersResponse = await axios.post(`${BASE_URL}/api/posts/create`, followersPostData, {
      headers: { ...headers, ...followersPostData.getHeaders() }
    });
    console.log('✅ Followers-only post created:', followersResponse.data.privacy);

    // Test 3: Create a select users post
    console.log('\n📝 Test 3: Creating select users post...');
    const selectUsersPostData = new FormData();
    selectUsersPostData.append('text', 'This is a select users post');
    selectUsersPostData.append('type', 'text');
    selectUsersPostData.append('privacy', 'select_users');
    selectUsersPostData.append('selectedUsers', JSON.stringify(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']));

    const selectUsersResponse = await axios.post(`${BASE_URL}/api/posts/create`, selectUsersPostData, {
      headers: { ...headers, ...selectUsersPostData.getHeaders() }
    });
    console.log('✅ Select users post created:', selectUsersResponse.data.privacy);

    // Test 4: Create an only me post
    console.log('\n📝 Test 4: Creating only me post...');
    const onlyMePostData = new FormData();
    onlyMePostData.append('text', 'This is an only me post');
    onlyMePostData.append('type', 'text');
    onlyMePostData.append('privacy', 'only_me');

    const onlyMeResponse = await axios.post(`${BASE_URL}/api/posts/create`, onlyMePostData, {
      headers: { ...headers, ...onlyMePostData.getHeaders() }
    });
    console.log('✅ Only me post created:', onlyMeResponse.data.privacy);

    console.log('\n🎉 All privacy tests passed!');

  } catch (error) {
    if (error.response) {
      console.error('❌ Test failed:', error.response.status, error.response.data);
    } else {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Test validation errors
async function testValidationErrors() {
  console.log('\n🧪 Testing Validation Errors\n');

  const authToken = 'your-jwt-token-here';
  const headers = {
    'Authorization': `Bearer ${authToken}`,
  };

  try {
    // Test invalid privacy level
    console.log('📝 Test: Invalid privacy level...');
    const invalidPrivacyData = new FormData();
    invalidPrivacyData.append('text', 'Test post');
    invalidPrivacyData.append('type', 'text');
    invalidPrivacyData.append('privacy', 'invalid_level');

    await axios.post(`${BASE_URL}/api/posts/create`, invalidPrivacyData, {
      headers: { ...headers, ...invalidPrivacyData.getHeaders() }
    });

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Invalid privacy level correctly rejected:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
  }

  try {
    // Test select_users without selectedUsers
    console.log('\n📝 Test: select_users without selectedUsers...');
    const missingUsersData = new FormData();
    missingUsersData.append('text', 'Test post');
    missingUsersData.append('type', 'text');
    missingUsersData.append('privacy', 'select_users');

    await axios.post(`${BASE_URL}/api/posts/create`, missingUsersData, {
      headers: { ...headers, ...missingUsersData.getHeaders() }
    });

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Missing selectedUsers correctly rejected:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
  }
}

// Run tests
console.log('⚠️  Note: You need to replace "your-jwt-token-here" with a valid JWT token to run these tests');
console.log('⚠️  You can get a token by logging in through the /api/auth/login endpoint\n');

// Uncomment these lines when you have a valid token:
// testPostCreationWithPrivacy();
// testValidationErrors();