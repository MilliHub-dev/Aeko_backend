# Authentication Issues Fixed

## Problems Identified

### 1. Repost Endpoint Error - "Post Not Found"
**Root Cause**: The repost endpoint was using `req.userId` but the auth middleware was setting `req.user.id`, causing the user ID to be undefined and failing to create reposts.

**Fix**: Updated to use fallback pattern: `req.userId || req.user?.id || req.user?._id`

### 2. Google OAuth Not Syncing with Email/Password Auth
**Root Cause**: Both Google OAuth and email/password login create JWT tokens with the same format `{ id: user._id }`, but the middleware was inconsistent in how it exposed the user ID to routes.

**Fix**: 
- Updated `authMiddleware.js` to ensure both `req.user.id` and `req.userId` are set consistently
- This ensures compatibility with both OAuth and traditional login flows

### 3. Profile Endpoints Returning "Authentication Required"
**Root Cause**: Profile routes (`/api/profile` and `/api/profile/update`) were using `req.userId` but the middleware was setting `req.user.id`.

**Fix**: Updated all profile route handlers to use the fallback pattern for user ID extraction

### 4. Users Endpoint Returning "Authentication Required"
**Root Cause**: Same issue - inconsistent property access between middleware and routes.

**Fix**: Updated user routes to use the fallback pattern

## Files Modified

### 1. `middleware/authMiddleware.js`
- Added `req.user.id = userId` to ensure the ID is available on the user object
- Maintained `req.userId` for backward compatibility

### 2. `routes/profile.js`
- Updated all endpoints to extract userId using: `const userId = req.userId || req.user?.id || req.user?._id`
- Added null checks for user lookups
- Fixed endpoints:
  - GET `/` (Get Profile)
  - PUT `/update` (Update Profile)
  - PUT `/change-password` (Change Password)
  - DELETE `/delete-account` (Delete Account)
  - GET `/followers` (List Followers)
  - GET `/following` (List Following)
  - GET `/followers/search` (Search Followers)
  - PUT `/unfollow/:id` (Unfollow User)

### 3. `routes/postRoutes.js`
- Updated all endpoints to use the fallback pattern
- Fixed endpoints:
  - POST `/` (Create Post)
  - POST `/repost/:postId` (Repost)
  - POST `/like/:postId` (Like Post)
  - PUT `/:postId/privacy` (Update Privacy)
  - POST `/:postId/share-to-status` (Share to Status)
  - POST `/:postId/promote` (Promote Post)
  - GET `/user/:userId` (Get User Posts)
  - GET `/feed` (Get Feed)
  - GET `/mixed` (Get Mixed Feed)
  - GET `/videos` (Get Videos)
  - GET `/:postId` (Get Single Post)

### 4. `routes/userRoutes.js`
- Updated profile picture upload endpoint
- Updated user profile view endpoint

### 5. `routes/status.js`
- Updated status creation endpoint
- Updated status deletion endpoint
- Updated status reaction endpoint
- Updated status list endpoint

## Testing Recommendations

1. **Test Google OAuth Flow**:
   - Login with Google OAuth
   - Verify token is issued correctly
   - Test accessing protected endpoints immediately after OAuth login
   - Verify `/api/profile`, `/api/profile/update`, `/api/users` work

2. **Test Email/Password Flow**:
   - Login with email/password
   - Verify all endpoints work the same as OAuth

3. **Test Repost Functionality**:
   - Create a post
   - Repost it
   - Verify the repost is created successfully

4. **Test Profile Operations**:
   - Get profile
   - Update profile
   - Change password
   - View followers/following

5. **Cross-Authentication Testing**:
   - Login with Google OAuth
   - Test all endpoints
   - Logout and login with email/password
   - Test all endpoints again
   - Verify consistent behavior

## Why This Solution Works

The fallback pattern `req.userId || req.user?.id || req.user?._id` ensures that:
1. Routes that expect `req.userId` continue to work
2. Routes that expect `req.user.id` continue to work
3. Both OAuth and traditional auth flows are supported
4. The code is backward compatible with existing implementations

The middleware now sets both properties, ensuring maximum compatibility across the entire codebase.
