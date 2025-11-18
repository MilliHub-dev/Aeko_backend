import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

// Test function to share a post to status
async function testShareToStatus() {
  console.log('🧪 Testing Post Share to Status Endpoint\n');

  // You'll need to replace this with a valid JWT token from your system
  // You can get this by logging in through the /api/auth/login endpoint
  const authToken = 'YOUR_JWT_TOKEN_HERE';
  
  // You'll also need a valid post ID to share
  const testPostId = 'YOUR_POST_ID_HERE';

  try {
    // Test 1: Share post to status without additional content
    console.log('📝 Test 1: Sharing post to status without additional content...');
    
    const response1 = await axios.post(
      `${BASE_URL}/api/posts/${testPostId}/share-to-status`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Post shared successfully:', response1.data);
    console.log('Status ID:', response1.data.status._id);
    console.log('Original content preserved:', response1.data.status.originalContent);

    // Test 2: Share post to status with additional content
    console.log('\n📝 Test 2: Sharing post to status with additional content...');
    
    const response2 = await axios.post(
      `${BASE_URL}/api/posts/${testPostId}/share-to-status`,
      {
        additionalContent: "This is an amazing post! Check it out!"
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Post shared with comment:', response2.data);
    console.log('Additional content:', response2.data.status.content);

  } catch (error) {
    if (error.response) {
      console.error('❌ Error response:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Test error scenarios
async function testErrorScenarios() {
  console.log('\n🧪 Testing Error Scenarios\n');

  const authToken = 'YOUR_JWT_TOKEN_HERE';

  try {
    // Test 1: Invalid post ID format
    console.log('📝 Test: Invalid post ID format...');
    
    const invalidIdResponse = await axios.post(
      `${BASE_URL}/api/posts/invalid-id/share-to-status`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected invalid post ID:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }

  try {
    // Test 2: Non-existent post ID
    console.log('\n📝 Test: Non-existent post ID...');
    
    const nonExistentResponse = await axios.post(
      `${BASE_URL}/api/posts/507f1f77bcf86cd799439011/share-to-status`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ Correctly rejected non-existent post:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }

  try {
    // Test 3: No authentication token
    console.log('\n📝 Test: No authentication token...');
    
    const noAuthResponse = await axios.post(
      `${BASE_URL}/api/posts/507f1f77bcf86cd799439011/share-to-status`,
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly rejected request without auth:', error.response.data.error);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

console.log('📋 Share to Status Endpoint Test');
console.log('=====================================');
console.log('Before running this test:');
console.log('1. Make sure your server is running on http://localhost:5000');
console.log('2. Replace YOUR_JWT_TOKEN_HERE with a valid JWT token');
console.log('3. Replace YOUR_POST_ID_HERE with a valid post ID');
console.log('4. Uncomment the test function calls below\n');

// Uncomment these lines when you have valid tokens and post IDs:
// testShareToStatus();
// testErrorScenarios();