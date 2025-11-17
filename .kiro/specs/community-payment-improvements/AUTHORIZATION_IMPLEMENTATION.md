# Authorization Implementation Summary

## Overview
This document summarizes the authorization checks added to all community-related endpoints as part of task 20.

## Changes Made

### 1. Middleware Enhancements

#### authMiddleware.js
- Added named exports `protect` and `authenticate` as aliases for the default export
- Ensures consistent authentication across all routes

#### communityMiddleware.js
- **Updated `isCommunityAdmin`**: Now checks only for community owner (not moderators)
  - Returns consistent error responses with `success: false` format
  - Handles CastError for invalid ObjectId format
  
- **Added `isCommunityAdminOrModerator`**: New middleware for operations that allow both owner and moderators
  - Checks if user is owner OR moderator
  - Sets `req.isOwner` and `req.isModerator` flags
  - Used for profile updates and content moderation
  
- **Updated `isCommunityMember`**: Enhanced membership verification
  - Owner and moderators are automatically considered members
  - Checks for active membership status
  - Sets `req.member` for member-specific operations
  
- **Added `checkPrivateCommunityAccess`**: New middleware for private community access control
  - Allows public communities to be accessed by anyone
  - Requires membership for private communities
  - Owner and moderators always have access
  
- **Enhanced `checkPaidCommunityAccess`**: Improved paid community subscription verification
  - Verifies both `isActive` flag and `endDate`
  - Automatic expiration handling
  - Returns detailed error messages with renewal information

### 2. Route Authorization Updates

#### communityRoutes.js
- **POST /api/communities**: Create community
  - ✅ `protect` - Authentication required
  - Controller validates golden tick requirement
  
- **GET /api/communities**: List communities
  - ✅ Public access (no auth required)
  
- **GET /api/communities/:id**: Get community details
  - ✅ `protect` - Authentication required
  - ✅ `checkPrivateCommunityAccess` - Membership required for private communities
  
- **POST /api/communities/:id/join**: Join community
  - ✅ `protect` - Authentication required
  - Controller handles paid community payment requirement
  
- **POST /api/communities/:id/leave**: Leave community
  - ✅ `protect` - Authentication required
  
- **PUT /api/communities/:id**: Update community
  - ✅ `protect` - Authentication required
  - ✅ `isCommunityAdminOrModerator` - Owner or moderator authorization
  
- **DELETE /api/communities/:id**: Delete community
  - ✅ `protect` - Authentication required
  - ✅ `isCommunityAdmin` - Owner-only authorization

#### communityProfileRoutes.js
- **PUT /api/communities/:id/profile**: Update profile
  - ✅ `protect` - Authentication required
  - ✅ `isCommunityAdminOrModerator` - Owner or moderator authorization
  
- **POST /api/communities/:id/upload-photo**: Upload photo
  - ✅ `protect` - Authentication required
  - ✅ `isCommunityAdminOrModerator` - Owner or moderator authorization
  
- **PUT /api/communities/:id/settings**: Update settings (including payment)
  - ✅ `protect` - Authentication required
  - ✅ `isCommunityAdmin` - Owner-only authorization (critical for payment settings)
  
- **POST /api/communities/:id/follow**: Follow community
  - ✅ `protect` - Authentication required
  
- **POST /api/communities/:id/unfollow**: Unfollow community
  - ✅ `protect` - Authentication required
  
- **POST /api/communities/:id/posts**: Create post
  - ✅ `protect` - Authentication required
  - ✅ `checkPaidCommunityAccess` - Active subscription for paid communities
  - ✅ `isCommunityMember` - Active membership required
  
- **GET /api/communities/:id/posts**: Get posts
  - ✅ `protect` - Authentication required
  - ✅ `checkPrivateCommunityAccess` - Membership for private communities
  - ✅ `checkPaidCommunityAccess` - Active subscription for paid communities

#### communityPaymentRoutes.js
- **POST /api/community/payment/initialize**: Initialize payment
  - ✅ `authenticate` - Authentication required
  
- **GET /api/community/payment/verify**: Verify payment
  - ✅ Public (called from payment provider callback)
  
- **POST /api/community/withdraw**: Request withdrawal
  - ✅ `authenticate` - Authentication required
  - ✅ `isCommunityAdmin` - Owner-only authorization
  
- **GET /api/community/:communityId/transactions**: Get transaction history
  - ✅ `authenticate` - Authentication required
  - ✅ `isCommunityAdmin` - Owner-only authorization

### 3. Swagger Documentation Updates

All endpoints now have comprehensive Swagger documentation including:
- Detailed descriptions of authorization requirements
- Security scheme references (`bearerAuth`)
- Complete request/response schemas
- HTTP status codes with explanations:
  - 200/201: Success
  - 400: Validation error or invalid ID format
  - 401: Unauthorized - authentication required
  - 402: Payment required (for paid communities)
  - 403: Forbidden - insufficient permissions
  - 404: Resource not found
  - 500: Server error

### 4. Error Response Standardization

All middleware now returns consistent error responses:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "requiresPayment": true,  // For paid communities
  "requiresRenewal": true,   // For expired subscriptions
  "subscriptionInfo": {}     // Additional context when relevant
}
```

## Authorization Matrix

| Endpoint | Authentication | Owner | Moderator | Member | Public |
|----------|---------------|-------|-----------|--------|--------|
| Create Community | ✅ | N/A | N/A | N/A | ❌ |
| List Communities | ❌ | ✅ | ✅ | ✅ | ✅ |
| Get Community (Public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get Community (Private) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Join Community | ✅ | N/A | N/A | N/A | ❌ |
| Leave Community | ✅ | ❌ | ✅ | ✅ | ❌ |
| Update Community | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Community | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Profile | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload Photo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Follow/Unfollow | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create Post | ✅ | ✅ | ✅ | ✅* | ❌ |
| Get Posts (Public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Get Posts (Private/Paid) | ✅ | ✅ | ✅ | ✅* | ❌ |
| Initialize Payment | ✅ | ✅ | ✅ | ✅ | ❌ |
| Verify Payment | ❌ | ✅ | ✅ | ✅ | ✅ |
| Request Withdrawal | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Transactions | ✅ | ✅ | ❌ | ❌ | ❌ |

*Requires active subscription for paid communities

## Requirements Satisfied

✅ **Requirement 5.1**: Community owner verification for settings updates
- `isCommunityAdmin` middleware on settings endpoint
- Owner-only access to payment settings

✅ **Requirement 5.2**: Active membership verification for paid content access
- `checkPaidCommunityAccess` middleware on content endpoints
- Subscription validation with expiration handling

✅ **Requirement 5.3**: Owner authorization for withdrawal requests
- `isCommunityAdmin` middleware on withdrawal endpoint
- Balance validation in service layer

✅ **Requirement 5.4**: Membership verification for private community access
- `checkPrivateCommunityAccess` middleware on private content
- Automatic membership check for owner/moderators

✅ **Consistent authorization error responses**
- Standardized error format across all middleware
- Detailed error messages with context

✅ **Updated swagger documentation**
- Complete API documentation for all endpoints
- Authorization requirements clearly documented
- Security schemes properly configured

## Testing Recommendations

1. **Authentication Tests**
   - Test endpoints without token (should return 401)
   - Test with expired token (should return 401)
   - Test with invalid token (should return 403)

2. **Authorization Tests**
   - Test owner-only endpoints as non-owner (should return 403)
   - Test moderator endpoints as regular member (should return 403)
   - Test member endpoints as non-member (should return 403)

3. **Private Community Tests**
   - Test accessing private community as non-member (should return 403)
   - Test accessing private community as member (should succeed)
   - Test owner/moderator access to private community (should succeed)

4. **Paid Community Tests**
   - Test accessing paid content without subscription (should return 403)
   - Test accessing paid content with expired subscription (should return 403 with renewal info)
   - Test accessing paid content with active subscription (should succeed)

5. **Edge Cases**
   - Test with invalid community ID format (should return 400)
   - Test with non-existent community (should return 404)
   - Test concurrent access scenarios
   - Test subscription expiration during active session

## Security Considerations

1. **Defense in Depth**: Multiple layers of authorization checks
2. **Fail Secure**: Default deny approach - explicit permission required
3. **Least Privilege**: Users only get minimum required permissions
4. **Audit Trail**: All authorization failures are logged
5. **Input Validation**: CastError handling for invalid ObjectIds
6. **Consistent Responses**: No information leakage through error messages
