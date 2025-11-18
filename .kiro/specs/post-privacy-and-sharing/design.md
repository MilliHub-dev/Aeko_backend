# Design Document

## Overview

This design extends the existing Post and Status systems to add privacy controls and post sharing functionality. The implementation will modify the Post model to include privacy settings, update the post creation and retrieval endpoints to handle privacy, and add a new endpoint for sharing posts to status.

## Architecture

### Privacy System Architecture
- **Privacy Levels**: Four distinct privacy levels (public, followers, select users, only me)
- **Visibility Filter**: Middleware-based filtering system that applies privacy rules during post retrieval
- **Relationship Checking**: Leverages existing follower relationships in User model
- **Selected Users Management**: New field to store specific user selections for "select users" privacy

### Post Sharing Architecture
- **Status Integration**: Extends existing Status model to reference shared posts
- **Content Preservation**: Maintains original post content and creator information in shared status
- **Privacy Inheritance**: Respects original post privacy when sharing

## Components and Interfaces

### Modified Post Model
```javascript
// Additional fields to be added to existing Post schema
privacy: {
  level: {
    type: String,
    enum: ['public', 'followers', 'select_users', 'only_me'],
    default: 'public'
  },
  selectedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}
```

### Modified Status Model
```javascript
// Additional fields to be added to existing Status schema
sharedPost: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Post',
  default: null
},
originalContent: {
  text: String,
  media: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

### Privacy Middleware
```javascript
// New middleware for filtering posts based on privacy settings
const applyPrivacyFilter = (requestingUserId) => {
  return (posts) => {
    // Filter logic based on privacy levels and user relationships
  }
}
```

### API Endpoints

#### Enhanced Post Creation
- **Endpoint**: `POST /api/posts/create`
- **New Parameters**: 
  - `privacy` (optional): Privacy level selection
  - `selectedUsers` (optional): Array of user IDs for "select_users" privacy
- **Validation**: Ensures selectedUsers is provided when privacy is "select_users"

#### Post Privacy Update
- **Endpoint**: `PUT /api/posts/:postId/privacy`
- **Parameters**:
  - `privacy`: New privacy level
  - `selectedUsers`: Updated user selection (if applicable)
- **Authorization**: Only post creator can update privacy

#### Post to Status Sharing
- **Endpoint**: `POST /api/posts/:postId/share-to-status`
- **Functionality**: Creates a new status entry referencing the original post
- **Privacy Check**: Validates requesting user can view the original post

#### Enhanced Post Retrieval
- **Modified Endpoints**: All existing post retrieval endpoints
- **Privacy Filtering**: Automatic application of privacy rules based on requesting user

## Data Models

### Post Privacy Schema Extension
```javascript
privacy: {
  level: {
    type: String,
    enum: ['public', 'followers', 'select_users', 'only_me'],
    default: 'public'
  },
  selectedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updateHistory: [{
    previousLevel: String,
    newLevel: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}
```

### Status Sharing Schema Extension
```javascript
sharedPost: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Post',
  default: null
},
originalContent: {
  text: String,
  media: String,
  type: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: Date
},
shareMetadata: {
  sharedAt: {
    type: Date,
    default: Date.now
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}
```

## Error Handling

### Privacy Validation Errors
- **Invalid Privacy Level**: Return 400 with clear error message
- **Missing Selected Users**: Return 400 when "select_users" privacy lacks user selection
- **Unauthorized Privacy Update**: Return 403 when non-creator attempts to update privacy

### Sharing Validation Errors
- **Post Not Found**: Return 404 when attempting to share non-existent post
- **Privacy Violation**: Return 403 when user cannot view post being shared
- **Self-Sharing Restriction**: Optional validation to prevent sharing own posts

### Visibility Filter Errors
- **Database Connection Issues**: Graceful degradation with public posts only
- **User Relationship Query Failures**: Fall back to basic privacy levels

## Testing Strategy

### Unit Tests
- Privacy level validation functions
- Visibility filter logic for each privacy level
- Post sharing content preservation
- Privacy update authorization checks

### Integration Tests
- End-to-end post creation with privacy settings
- Post retrieval with different user relationships
- Status creation from shared posts
- Privacy update workflows

### Privacy Security Tests
- Unauthorized access attempts to private posts
- Follower relationship manipulation attempts
- Selected user list tampering validation
- Privacy escalation prevention

## Implementation Considerations

### Performance Optimization
- **Indexing**: Add database indexes for privacy fields and user relationships
- **Caching**: Cache follower relationships for frequent privacy checks
- **Batch Processing**: Optimize visibility filtering for large post sets

### Backward Compatibility
- **Default Privacy**: All existing posts default to "public" privacy
- **Migration Strategy**: Gradual rollout with feature flags
- **API Versioning**: Maintain existing endpoint behavior while adding new features

### Security Measures
- **Input Validation**: Strict validation of privacy parameters and user selections
- **Authorization Checks**: Multi-level authorization for privacy updates and post access
- **Audit Logging**: Track privacy setting changes for security monitoring