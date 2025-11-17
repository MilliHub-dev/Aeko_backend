import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { checkExpiringSubscriptions } from './jobs/subscriptionExpirationNotifications.js';

dotenv.config();

/**
 * Test script to manually trigger subscription expiration notifications
 * Usage: node test-subscription-notifications.js
 */
async function testNotifications() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('📧 Running subscription expiration check...');
    const result = await checkExpiringSubscriptions();
    
    console.log('\n✅ Test complete!');
    console.log('Results:', result);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testNotifications();
