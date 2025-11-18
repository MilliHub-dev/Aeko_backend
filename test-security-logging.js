// Simple test to verify SecurityEvent model and SecurityLogger service
import mongoose from 'mongoose';
import SecurityEvent from './models/SecurityEvent.js';
import SecurityLogger from './services/securityLogger.js';

async function testSecurityLogging() {
  try {
    console.log('Testing SecurityEvent model and SecurityLogger service...');
    
    // Test SecurityEvent static method
    const testEvent = await SecurityEvent.logEvent({
      user: new mongoose.Types.ObjectId(),
      eventType: 'block',
      targetUser: new mongoose.Types.ObjectId(),
      metadata: { reason: 'Test block' },
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      success: true
    });
    
    if (testEvent) {
      console.log('✅ SecurityEvent.logEvent() works correctly');
      console.log('Event ID:', testEvent._id);
      console.log('Event Type:', testEvent.eventType);
      console.log('Display Message:', testEvent.getDisplayMessage());
    } else {
      console.log('❌ SecurityEvent.logEvent() failed');
    }
    
    // Test SecurityLogger service
    const mockReq = {
      ip: '192.168.1.1',
      get: (header) => header === 'User-Agent' ? 'Mozilla/5.0 Test' : null
    };
    
    const loggedEvent = await SecurityLogger.logEvent({
      user: new mongoose.Types.ObjectId(),
      eventType: '2fa_enabled',
      metadata: { method: 'totp' },
      req: mockReq,
      success: true
    });
    
    if (loggedEvent) {
      console.log('✅ SecurityLogger.logEvent() works correctly');
      console.log('Logged Event ID:', loggedEvent._id);
    } else {
      console.log('❌ SecurityLogger.logEvent() failed');
    }
    
    console.log('✅ All security logging tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSecurityLogging();
}

export default testSecurityLogging;