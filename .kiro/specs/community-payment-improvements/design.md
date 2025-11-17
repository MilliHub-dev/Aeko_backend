# Design Document

## Overview

This design addresses critical issues in the community and payment implementation including data model inconsistencies, incomplete payment flows, missing error handling, and security vulnerabilities. The solution focuses on refactoring existing code to ensure data integrity, reliable payment processing, and proper authorization.

## Architecture

### Current Architecture Issues

1. **Duplicate Schema Fields**: Community model has duplicate `settings` and `isPrivate` fields
2. **Inconsistent Data Structures**: Member data stored differently in Community vs User models
3. **Missing Imports**: Payment service lacks mongoose import for transactions
4. **Incomplete Error Handling**: Many operations lack try-catch blocks and validation
5. **Authorization Gaps**: Middleware doesn't consistently check all required conditions

### Improved Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Routes)                       │
│  - Input validation with express-validator                   │
│  - Consistent error response format                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Middleware Layer                            │
│  - Authentication (protect)                                  │
│  - Authorization (isCommunityAdmin, isCommunityMember)       │
│  - Subscription validation (checkPaidCommunityAccess)        │
│  - Consistent parameter extraction                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Controller Layer                             │
│  - Business logic orchestration                              │
│  - Service layer calls                                       │
│  - Response formatting                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Service Layer                               │
│  - Payment processing (Paystack, Stripe, Aeko)              │
│  - Transaction management with DB sessions                   │
│  - External API integration                                  │
│  - Retry logic and error handling                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Data Layer (Models)                        │
│  - Unified schema definitions                                │
│  - Consistent field naming                                   │
│  - Proper indexes for performance                            │
│  - Model methods for common operations                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Community Model Refactoring

**Changes Required:**
- Remove duplicate `settings` field (lines 47-67 conflict with lines 127-137)
- Remove duplicate `isPrivate` field (line 99 conflicts with nested settings.isPrivate)
- Consolidate all settings under single nested structure
- Ensure consistent member data structure

**Unified Settings Structure:**
```javascript
settings: {
  isPrivate: Boolean,
  requireApproval: Boolean,
  canPost: Boolean,
  canComment: Boolean,
  payment: {
    isPaidCommunity: Boolean,
    price: Number,
    currency: String,
    subscriptionType: String,
    paymentMethods: [String],
    walletAddress: String,
    stripeAccountId: String,
    paystackSubaccount: String,
    availableForWithdrawal: Number,
    totalEarnings: Number,
    pendingWithdrawals: Number,  // NEW: Track pending amounts
    withdrawalHistory: [Object]
  },
  postSettings: {
    allowImages: Boolean,
    allowVideos: Boolean,
    allowLinks: Boolean,
    requireApproval: Boolean
  }
}
```

**Member Structure Alignment:**
```javascript
// Community.members
members: [{
  user: ObjectId,
  role: String,  // 'member', 'moderator', 'owner'
  joinedAt: Date,
  status: String,  // 'pending', 'active', 'banned'
  subscription: {
    type: String,
    startDate: Date,
    endDate: Date,
    isActive: Boolean,
    paymentMethod: String,
    transactionId: ObjectId
  }
}]

// User.communities (should match)
communities: [{
  community: ObjectId,
  role: String,  // Must match Community.members.role
  joinedAt: Date,
  notifications: Boolean,
  subscription: {  // NEW: Add subscription tracking
    type: String,
    startDate: Date,
    endDate: Date,
    isActive: Boolean,
    paymentMethod: String,
    transactionId: ObjectId
  }
}]
```

### 2. Payment Service Improvements

**Missing Imports:**
```javascript
import mongoose from 'mongoose';
import User from '../models/User.js';
```

**Payment Initialization Flow:**
```
1. Validate user exists and fetch email
2. Validate community exists and is paid
3. Check if user already has active subscription
4. Create transaction record (status: 'pending')
5. Call payment provider API
6. Return authorization URL/client secret
7. Handle errors and update transaction status
```

**Payment Verification Flow:**
```
1. Find transaction by reference
2. Check if already completed (idempotency)
3. Call payment provider verification API
4. If successful:
   a. Start database session
   b. Update transaction status
   c. Update community membership
   d. Update user communities array
   e. Update community earnings
   f. Commit session
5. If failed:
   a. Update transaction status to 'failed'
   b. Log error details
   c. Return error to user
```

**Withdrawal Flow with Atomicity:**
```javascript
async function requestWithdrawal({ communityId, adminId, amount, method, details }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Verify owner
    // 2. Check available balance (total - pending)
    // 3. Process withdrawal based on method
    // 4. Update availableForWithdrawal
    // 5. Increment pendingWithdrawals
    // 6. Add to withdrawalHistory
    // 7. Commit transaction
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 3. Middleware Enhancements

**Consistent Parameter Extraction:**
```javascript
// Extract communityId from multiple sources
const communityId = req.params.id || req.params.communityId || req.body.communityId;

if (!communityId) {
  return res.status(400).json({ 
    success: false,
    message: 'Community ID is required' 
  });
}
```

**Enhanced Subscription Check:**
```javascript
export const checkPaidCommunityAccess = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId;
    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Skip if not paid
    if (!community.settings?.payment?.isPaidCommunity) {
      return next();
    }

    // Owner and moderators always have access
    if (community.owner.toString() === req.user.id ||
        community.moderators.some(id => id.toString() === req.user.id)) {
      return next();
    }

    // Check member subscription
    const member = community.members.find(
      m => m.user.toString() === req.user.id && m.status === 'active'
    );

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'You need to join this community',
        requiresPayment: true
      });
    }

    // Verify subscription is active and not expired
    if (!member.subscription?.isActive) {
      return res.status(403).json({
        success: false,
        message: 'You need an active subscription',
        requiresPayment: true
      });
    }

    if (member.subscription.endDate && 
        new Date() > new Date(member.subscription.endDate)) {
      // Auto-expire subscription
      member.subscription.isActive = false;
      await community.save();
      
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired',
        requiresRenewal: true
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};
```

### 4. Controller Improvements

**Consistent Error Handling Pattern:**
```javascript
export const someController = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    // Business logic
    const result = await someService();

    // Success response
    res.status(200).json({
      success: true,
      data: result,
      message: 'Operation successful'
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    // Distinguish between different error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

**Join Community with Payment:**
```javascript
export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    const userId = req.user.id;

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if already a member
    const existingMember = community.members.find(
      m => m.user.toString() === userId
    );

    if (existingMember) {
      if (existingMember.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'You are already a member'
        });
      }
      if (existingMember.status === 'banned') {
        return res.status(403).json({
          success: false,
          message: 'You are banned from this community'
        });
      }
    }

    // Check if paid community
    if (community.settings?.payment?.isPaidCommunity) {
      return res.status(402).json({
        success: false,
        message: 'This is a paid community. Please complete payment first.',
        requiresPayment: true,
        paymentInfo: {
          price: community.settings.payment.price,
          currency: community.settings.payment.currency,
          subscriptionType: community.settings.payment.subscriptionType,
          availableMethods: community.settings.payment.paymentMethods
        }
      });
    }

    // For free communities, add directly or pending approval
    const status = community.settings?.requireApproval ? 'pending' : 'active';
    
    await community.addMember(userId, 'member');
    
    // Update member status
    const member = community.members.find(m => m.user.toString() === userId);
    member.status = status;
    await community.save();

    // Add to user's communities
    await User.findByIdAndUpdate(userId, {
      $push: {
        communities: {
          community: community._id,
          role: 'member',
          joinedAt: new Date()
        }
      }
    });

    // Add to chat if active
    if (status === 'active' && community.chat) {
      await Chat.findByIdAndUpdate(community.chat, {
        $addToSet: { users: userId }
      });
    }

    res.status(200).json({
      success: true,
      message: status === 'pending' ? 
        'Join request sent. Waiting for approval.' : 
        'Successfully joined the community',
      data: { status }
    });
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
```

## Data Models

### Transaction Model Enhancement

Add fields for better tracking:
```javascript
{
  user: ObjectId,
  community: ObjectId,
  amount: Number,
  currency: String,
  paymentMethod: String,
  status: String,
  paymentReference: String,
  metadata: Object,
  
  // NEW FIELDS
  providerResponse: Object,  // Store full provider response
  failureReason: String,     // Store failure details
  retryCount: Number,        // Track retry attempts
  verifiedAt: Date,          // When verification completed
  
  isWithdrawn: Boolean,
  withdrawalRequest: {
    requestedAt: Date,
    processedAt: Date,
    status: String,
    reference: String,
    failureReason: String    // NEW: Track withdrawal failures
  }
}
```

## Error Handling

### Standardized Error Response Format

```javascript
{
  success: false,
  message: "Human-readable error message",
  error: "Technical error details (dev mode only)",
  code: "ERROR_CODE",  // e.g., "INSUFFICIENT_BALANCE"
  details: {
    // Additional context
  }
}
```

### Error Categories

1. **Validation Errors (400)**: Invalid input, missing required fields
2. **Authentication Errors (401)**: Missing or invalid token
3. **Authorization Errors (403)**: Insufficient permissions
4. **Not Found Errors (404)**: Resource doesn't exist
5. **Payment Required (402)**: Paid community requires payment
6. **Conflict Errors (409)**: Already exists, duplicate action
7. **Server Errors (500)**: Unexpected errors, database failures
8. **Service Unavailable (503)**: External service down

### Retry Logic for External APIs

```javascript
async function callWithRetry(apiCall, maxRetries = 1) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
  
  throw lastError;
}
```

## Testing Strategy

### Unit Tests

1. **Model Methods**
   - Test addMember/removeMember with various scenarios
   - Test isMember/isModerator logic
   - Test subscription expiration checks

2. **Service Functions**
   - Mock external API calls (Paystack, Stripe)
   - Test payment initialization with different methods
   - Test payment verification with success/failure cases
   - Test withdrawal logic with balance validation

3. **Middleware**
   - Test parameter extraction from different sources
   - Test authorization with various user roles
   - Test subscription validation with expired/active subscriptions

### Integration Tests

1. **Payment Flow**
   - Initialize payment → Verify payment → Check membership
   - Test with all three payment methods
   - Test failure scenarios and rollback

2. **Community Lifecycle**
   - Create → Join → Post → Leave → Delete
   - Test with free and paid communities
   - Test with private and public communities

3. **Subscription Management**
   - Subscribe → Access content → Expire → Renew
   - Test automatic expiration handling
   - Test access control at each stage

### Edge Cases to Test

1. Concurrent payment attempts for same user/community
2. Payment verification called multiple times (idempotency)
3. Subscription expiring during active session
4. Withdrawal requested while payment is processing
5. Community deleted while payments are pending
6. User deleted with active subscriptions
7. Network failures during payment processing
8. Database transaction rollback scenarios

## Migration Strategy

### Phase 1: Data Model Cleanup

1. Create migration script to consolidate duplicate fields
2. Backup existing data
3. Run migration on staging environment
4. Verify data integrity
5. Deploy to production during low-traffic period

### Phase 2: Code Refactoring

1. Update Community model (remove duplicates)
2. Update controllers with improved error handling
3. Update middleware with consistent logic
4. Update payment service with missing imports
5. Deploy incrementally with feature flags

### Phase 3: Testing and Validation

1. Run comprehensive test suite
2. Monitor error logs for issues
3. Validate payment flows in production
4. Check subscription expiration handling
5. Verify withdrawal processing

### Migration Script Example

```javascript
// migrate-community-settings.js
async function migrateCommunitySettings() {
  const communities = await Community.find({});
  
  for (const community of communities) {
    // Merge duplicate settings
    const mergedSettings = {
      isPrivate: community.isPrivate || community.settings?.isPrivate || false,
      requireApproval: community.settings?.approvalRequired || 
                       community.settings?.requireApproval || false,
      canPost: community.settings?.canPost ?? true,
      canComment: community.settings?.canComment ?? true,
      payment: community.settings?.payment || {},
      postSettings: community.settings?.postSettings || {}
    };
    
    // Update with merged settings
    await Community.updateOne(
      { _id: community._id },
      { 
        $set: { settings: mergedSettings },
        $unset: { 
          isPrivate: "",
          approvalRequired: ""
        }
      }
    );
  }
  
  console.log(`Migrated ${communities.length} communities`);
}
```

## Performance Considerations

### Database Indexes

```javascript
// Community model indexes
CommunitySchema.index({ name: 'text', description: 'text' });
CommunitySchema.index({ owner: 1 });
CommunitySchema.index({ 'members.user': 1 });
CommunitySchema.index({ 'settings.payment.isPaidCommunity': 1 });
CommunitySchema.index({ createdAt: -1 });

// Transaction model indexes
TransactionSchema.index({ user: 1, community: 1 });
TransactionSchema.index({ paymentReference: 1 }, { unique: true });
TransactionSchema.index({ status: 1, createdAt: -1 });
TransactionSchema.index({ community: 1, status: 1 });
```

### Query Optimization

1. Use lean() for read-only queries
2. Select only required fields
3. Populate only necessary references
4. Implement pagination for large result sets
5. Cache frequently accessed data (community settings)

### Caching Strategy

```javascript
// Cache community settings for 5 minutes
const getCommunitySettings = async (communityId) => {
  const cacheKey = `community:${communityId}:settings`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const community = await Community.findById(communityId)
    .select('settings')
    .lean();
    
  await redis.setex(cacheKey, 300, JSON.stringify(community.settings));
  
  return community.settings;
};
```

## Security Enhancements

### Input Validation

```javascript
// Validate payment amount
body('amount')
  .isFloat({ min: 0.01, max: 1000000 })
  .withMessage('Amount must be between 0.01 and 1,000,000'),

// Validate subscription type
body('subscriptionType')
  .isIn(['one_time', 'monthly', 'yearly'])
  .withMessage('Invalid subscription type'),

// Validate payment method
body('paymentMethod')
  .isIn(['paystack', 'stripe', 'aeko_wallet'])
  .withMessage('Invalid payment method')
```

### Rate Limiting

```javascript
// Limit payment initialization attempts
const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many payment attempts, please try again later'
});

router.post('/initialize', paymentRateLimiter, authenticate, initializePayment);
```

### Sensitive Data Protection

1. Never log payment credentials or tokens
2. Mask sensitive data in error messages
3. Use environment variables for API keys
4. Implement request signing for webhooks
5. Validate webhook signatures from payment providers
