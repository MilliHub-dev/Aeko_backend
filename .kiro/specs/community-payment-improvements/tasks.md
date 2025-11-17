# Implementation Plan

- [x] 1. Fix Community Model Data Inconsistencies




  - Remove duplicate `settings` field definition (keep the comprehensive one at lines 47-67, remove the one at lines 127-137)
  - Remove duplicate `isPrivate` field (line 99) since it exists in settings.isPrivate
  - Add `pendingWithdrawals` field to settings.payment to track pending withdrawal amounts
  - Update model indexes to include settings.payment.isPaidCommunity for query optimization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.1, 10.2, 10.3_
- [x] 2. Add Missing Imports to Payment Service



- [ ] 2. Add Missing Imports to Payment Service

  - Add `import mongoose from 'mongoose'` at the top of communityPaymentService.js
  - Add `import User from '../models/User.js'` to access user data
  - Add `import Community from '../models/Community.js'` if not already present
  - Add `import Transaction from '../models/Transaction.js'` if not already present
  - _Requirements: 8.1, 9.1_

- [x] 3. Fix Payment Initialization Flow





  - In `initializePayment` function, fetch user from database before creating transaction
  - Extract user email and validate user exists
  - Pass user email to `initializePaystackPayment` function
  - Add validation to check if user already has active subscription before initializing payment
  - Add error handling for user not found scenario
  - _Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 8.5_


- [x] 4. Implement Payment Verification Idempotency




  - In `verifyPayment` function, check if transaction status is already 'completed' at the start
  - Return cached success response if payment already verified
  - Add logging for duplicate verification attempts
  - _Requirements: 2.3_


- [x] 5. Add Database Transactions to Withdrawal Flow



  - Wrap withdrawal processing in mongoose session/transaction
  - Ensure all database updates (community balance, withdrawal history) happen atomically
  - Implement proper rollback on failure
  - Add session.endSession() in finally block to prevent memory leaks
  - _Requirements: 9.2, 9.3, 9.4, 9.5_

- [x] 6. Implement Withdrawal Balance Validation





  - Add `pendingWithdrawals` tracking to community payment settings
  - Calculate available balance as `totalEarnings - pendingWithdrawals`
  - Update `requestWithdrawal` to check available balance before processing
  - Increment `pendingWithdrawals` when withdrawal is initiated
  - Decrement `pendingWithdrawals` when withdrawal completes or fails
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 7. Fix Middleware Parameter Extraction




  - Update `isCommunityAdmin` middleware to check req.params.id, req.params.communityId, and req.body.communityId
  - Update `isCommunityMember` middleware with same parameter extraction logic
  - Update `checkPaidCommunityAccess` middleware with same parameter extraction logic
  - Ensure consistent order: params.id → params.communityId → body.communityId
  - _Requirements: 6.1, 6.4_

- [x] 8. Enhance Subscription Validation in Middleware




  - Update `checkPaidCommunityAccess` to verify both isActive flag and endDate
  - Add automatic expiration handling when endDate is past current date
  - Update member.subscription.isActive to false when expired
  - Save community after updating expired subscription
  - Return appropriate error message with requiresRenewal flag
  - _Requirements: 3.2, 6.3, 14.1, 14.2, 14.4_
-

- [x] 9. Improve Error Handling in Controllers




  - Add try-catch blocks to all controller functions that are missing them
  - Implement consistent error response format with success, message, and error fields
  - Distinguish between ValidationError, CastError, and generic errors
  - Add appropriate HTTP status codes for different error types
  - Log errors with context information for debugging
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 10. Update Join Community Controller for Paid Communities












- [ ] 10. Update Join Community Controller for Paid Communities
  - Check if community is paid before allowing direct join
  - Return 402 Payment Required status with payment info if community is paid
  - Include price, currency, subscriptionType, and available payment methods in response
  - Ensure free communities still work with existing logic
  - _Requirements: 2.1, 12.1, 12.2_

- [x] 11. Implement Payment Method Validation





  - In payment initialization, verify selected payment method is in community.settings.payment.paymentMethods array
  - For Stripe, verify stripeAccountId exists before processing
  - For Paystack, verify paystackSubaccount exists before processing
  - Return clear error message if payment method not configured
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12. Add Retry Logic to Payment Provider Calls





  - Create `callWithRetry` helper function with exponential backoff
  - Wrap Paystack API calls in retry logic (max 1 retry)
  - Wrap Stripe API calls in retry logic (max 1 retry)
  - Don't retry on 4xx client errors, only 5xx server errors
  - Update transaction with retry count and failure reason
  - _Requirements: 4.3_

- [x] 13. Fix Aeko Wallet Payment Processing








- [ ] 13. Fix Aeko Wallet Payment Processing

  - Implement proper wallet balance check before processing payment
  - Use database transaction to ensure atomic deduction from user wallet and credit to community
  - Add proper error handling for insufficient balance
  - Update both user wallet and community earnings atomically
  - _Requirements: 2.4, 2.5_

- [x] 14. Synchronize Member Data Between Models





  - When adding member to community, also update User.communities array with matching role
  - When updating member role, update both Community.members and User.communities
  - When removing member, update both models atomically
  - Ensure subscription data is stored consistently in both models
  - _Requirements: 1.3, 3.5, 11.1, 11.2, 11.3_
- [x] 15. Add Transaction Model Enhancements



- [ ] 15. Add Transaction Model Enhancements

  - Add `providerResponse` field to store full payment provider response
  - Add `failureReason` field to store detailed error information
  - Add `retryCount` field to track retry attempts
  - Add `verifiedAt` field to timestamp verification completion
  - Add `failureReason` to withdrawalRequest subdocument
  - _Requirements: 7.4_


- [x] 16. Implement Subscription Expiration Notifications




  - Create scheduled job to check for subscriptions expiring in 7 days
  - Send email notification to users with expiring subscriptions
  - Include renewal link and pricing information in notification
  - Log notification events for analytics
  - _Requirements: 14.3_
-

- [x] 17. Fix Cloudinary Import in Profile Controller




  - Update import path for uploadToCloudinary utility
  - Verify the utility exists at the correct path (check utils/cloudinary.js or services/cloudinaryService.js)
  - Add error handling for missing Cloudinary configuration
  - Validate file type and size before uploading
  - Return clear error if upload fails without updating community profile
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 1
5.5_
- [x] 18. Add Comprehensive Input Validation




- [ ] 18. Add Comprehensive Input Validation

  - Add validation for payment amount (min: 0.01, max: 1000000)
  - Add validation for subscription type enum values
  - Add validation for payment method enum values
  - Add validation for withdrawal amount and method
  - Add validation for community settings updates
  - _Requirements: 4.1, 5.5_

- [x] 19. Implement Transaction History Endpoint




  - Fix Transaction import in communityPaymentRoutes.js
  - Implement proper pagination for transaction queries
  - Add filtering by status and date range
  - Include user information in transaction response
  - Calculate and return summary statistics (total earnings, pending, completed)
  - _Requirements: 7.1, 7.3_

- [x] 20. Add Authorization Checks to All Endpoints




  - Verify community owner for settings updates
  - Verify active membership for paid content access
  - Verify owner authorization for withdrawal requests
  - Verify membership for private community access
  - Add consistent authorization error responses
  - update swagger documentation
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 21. Create Data Migration Script
  - Write script to consolidate duplicate settings fields in existing communities
  - Backup existing data before migration
  - Merge isPrivate and settings.isPrivate into single field
  - Merge duplicate settings objects
  - Test migration on staging environment first
  - _Requirements: 10.4_

- [ ]* 22. Add Database Indexes for Performance
  - Add index on Community.settings.payment.isPaidCommunity
  - Add index on Transaction.paymentReference (unique)
  - Add index on Transaction.status and createdAt
  - Add compound index on Transaction.community and status
  - Verify index creation and measure query performance improvement
  - _Requirements: Performance optimization_

- [ ]* 23. Implement Rate Limiting for Payment Endpoints
  - Add rate limiter middleware for payment initialization (5 requests per 15 minutes)
  - Add rate limiter for withdrawal requests (3 requests per hour)
  - Configure appropriate error messages for rate limit exceeded
  - Log rate limit violations for monitoring
  - _Requirements: Security enhancement_

- [ ]* 24. Add Webhook Handlers for Payment Providers
  - Implement Paystack webhook handler for payment notifications
  - Implement Stripe webhook handler for payment events
  - Verify webhook signatures for security
  - Handle payment success, failure, and refund events
  - Update transaction and membership status based on webhook events
  - _Requirements: 2.2, 2.3_

- [ ]* 25. Create Integration Tests for Payment Flow
  - Test complete payment flow: initialize → verify → membership granted
  - Test payment failure scenarios and rollback
  - Test concurrent payment attempts for same user/community
  - Test payment verification idempotency
  - Test subscription expiration and renewal
  - _Requirements: Testing strategy_

- [ ]* 26. Add Monitoring and Logging
  - Add structured logging for all payment operations
  - Log payment initialization, verification, and failures
  - Log withdrawal requests and processing
  - Add metrics for payment success/failure rates
  - Set up alerts for high failure rates or errors
  - _Requirements: Operational excellence_
