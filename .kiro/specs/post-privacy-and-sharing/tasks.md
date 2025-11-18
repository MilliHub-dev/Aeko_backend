# Implementation Plan

- [x] 1. Update Post model with privacy fields




  - Add privacy schema fields to Post model including level, selectedUsers, and audit trail
  - Add database indexes for privacy fields to optimize queries
  - Create model methods for privacy validation and checking user access
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.5_

- [x] 2. Create privacy middleware and utilities





  - [x] 2.1 Implement privacy filtering middleware


    - Write middleware function to filter posts based on requesting user's permissions
    - Implement follower relationship checking logic
    - Add selected users validation for "select_users" privacy level
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Create privacy validation utilities


    - Write utility functions to validate privacy level changes
    - Implement authorization checks for privacy updates
    - Create helper functions for user relationship queries
    - _Requirements: 4.1, 4.4_


- [x] 3. Update Post model with Status sharing support




  - Modify Status model to include sharedPost reference and original content preservation
  - Add methods to Status model for creating shared post statuses
  - Implement content copying logic to preserve original post data in status
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Enhance post creation endpoint with privacy controls




  - [x] 4.1 Update POST /api/posts/create endpoint


    - Add privacy parameter validation to post creation
    - Implement selectedUsers handling for "select_users" privacy
    - Update request validation to ensure proper privacy parameter format
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 4.2 Write unit tests for enhanced post creation
    - Test privacy parameter validation
    - Test selectedUsers array handling
    - Test default privacy behavior for backward compatibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Implement post privacy update endpoint



  - [x] 5.1 Create PUT /api/posts/:postId/privacy endpoint


    - Implement privacy level update functionality
    - Add authorization checks to ensure only post creator can update privacy
    - Create audit trail logging for privacy changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 Write unit tests for privacy updates
    - Test authorization validation for privacy updates
    - Test privacy level transition validation
    - Test audit trail creation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [-] 6. Create post to status sharing endpoint


  - [x] 6.1 Implement POST /api/posts/:postId/share-to-status endpoint



    - Create endpoint to share existing posts as status updates
    - Implement privacy checking to ensure user can view original post
    - Add original post content preservation in shared status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.2 Write unit tests for post sharing
    - Test privacy validation during sharing
    - Test content preservation in shared status
    - Test status expiration behavior for shared posts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Update existing post retrieval endpoints with privacy filtering





  - [x] 7.1 Apply privacy middleware to GET /api/posts/feed endpoint


    - Integrate privacy filtering middleware into feed endpoint
    - Ensure proper user relationship checking for follower-only posts
    - Test performance impact of privacy filtering on large feeds
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.2 Apply privacy middleware to GET /api/posts/user/:userId endpoint


    - Add privacy filtering to user-specific post retrieval
    - Implement proper authorization for viewing other users' private posts
    - Ensure post creator can always see their own posts regardless of privacy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.3 Apply privacy middleware to GET /api/posts/:postId endpoint


    - Add privacy checking to single post retrieval
    - Return appropriate error messages for unauthorized access attempts
    - Maintain backward compatibility for existing public posts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 8. Update Status routes to handle shared posts


  - [x] 8.1 Enhance GET /api/status endpoint for shared post display



    - Modify status retrieval to properly populate shared post information
    - Add original post creator information to shared status responses
    - Implement proper formatting for shared post content in status feed
    - _Requirements: 2.2, 2.3_

  - [ ]* 8.2 Write integration tests for shared post status display
    - Test shared post status creation and retrieval
    - Test original post information preservation
    - Test status expiration behavior with shared posts
    - _Requirements: 2.2, 2.3_
- [x] 9. Add database migrations and indexes




- [ ] 9. Add database migrations and indexes

  - Create database migration script to add privacy fields to existing posts
  - Add database indexes for privacy fields and selectedUsers arrays
  - Implement data migration to set default "public" privacy for existing posts
  - update swagger document 
  - _Requirements: 1.1, 3.1_

- [ ]* 10. Create comprehensive integration tests
  - Write end-to-end tests for complete privacy workflow
  - Test post creation, privacy updates, and sharing across different user relationships
  - Test edge cases and error scenarios for privacy violations
  - _Requirements: All requirements_