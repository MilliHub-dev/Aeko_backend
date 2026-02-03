import { prisma } from "../config/db.js";

/**
 * Custom validator to check if value is a valid ID (UUID or MongoDB ObjectId)
 */
const isValidId = (value) => {
  // Check for MongoDB ObjectId (24 hex characters)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
  // Check for UUID (standard format)
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  
  return isObjectId || isUUID;
};

/**
 * Privacy validation utilities for post privacy management
 * Handles privacy level validation, authorization checks, and user relationship queries
 */
const privacyUtils = {
  /**
   * Valid privacy levels for posts
   */
  PRIVACY_LEVELS: ['public', 'followers', 'select_users', 'only_me'],

  /**
   * Validate privacy level and associated parameters
   * @param {String} privacyLevel - The privacy level to validate
   * @param {Array} selectedUsers - Array of user IDs for select_users privacy
   * @returns {Object} Validation result with success status and error message
   */
  validatePrivacyLevel(privacyLevel, selectedUsers = []) {
    try {
      // Check if privacy level is valid
      if (!this.PRIVACY_LEVELS.includes(privacyLevel)) {
        return {
          success: false,
          error: `Invalid privacy level. Must be one of: ${this.PRIVACY_LEVELS.join(', ')}`
        };
      }

      // Validate selectedUsers for select_users privacy level
      if (privacyLevel === 'select_users') {
        if (!selectedUsers || !Array.isArray(selectedUsers) || selectedUsers.length === 0) {
          return {
            success: false,
            error: 'Selected users must be provided as a non-empty array for select_users privacy level'
          };
        }

        // Validate that all selectedUsers are valid IDs
        for (const userId of selectedUsers) {
          if (!isValidId(userId)) {
            return {
              success: false,
              error: `Invalid user ID in selectedUsers: ${userId}`
            };
          }
        }

        // Check for duplicate user IDs
        const uniqueUsers = [...new Set(selectedUsers.map(id => id.toString()))];
        if (uniqueUsers.length !== selectedUsers.length) {
          return {
            success: false,
            error: 'Duplicate user IDs found in selectedUsers array'
          };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Privacy validation error: ${error.message}`
      };
    }
  },

  /**
   * Validate privacy level transition (some transitions may be restricted)
   * @param {String} currentLevel - Current privacy level
   * @param {String} newLevel - New privacy level
   * @returns {Object} Validation result
   */
  validatePrivacyTransition(currentLevel, newLevel) {
    try {
      // All transitions are currently allowed
      // This method can be extended to add business rules for privacy transitions
      
      if (!this.PRIVACY_LEVELS.includes(currentLevel)) {
        return {
          success: false,
          error: 'Invalid current privacy level'
        };
      }

      if (!this.PRIVACY_LEVELS.includes(newLevel)) {
        return {
          success: false,
          error: 'Invalid new privacy level'
        };
      }

      // Example business rule: prevent changing from 'only_me' to 'public' directly
      // if (currentLevel === 'only_me' && newLevel === 'public') {
      //   return {
      //     success: false,
      //     error: 'Cannot change privacy from "only me" to "public" directly. Change to "followers" first.'
      //   };
      // }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Privacy transition validation error: ${error.message}`
      };
    }
  },

  /**
   * Check if a user is authorized to update post privacy
   * @param {Object} post - Post object
   * @param {String} userId - ID of user attempting to update privacy
   * @returns {Object} Authorization result
   */
  async checkPrivacyUpdateAuthorization(post, userId) {
    try {
      if (!post) {
        return {
          success: false,
          error: 'Post not found'
        };
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required'
        };
      }

      // Only post creator can update privacy settings
      // Handle both Prisma object (userId) and potential legacy structure
      const postCreatorId = post.userId || post.user?._id?.toString() || post.user?.toString();
      
      if (postCreatorId !== userId.toString()) {
        return {
          success: false,
          error: 'Only the post creator can update privacy settings'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Authorization check error: ${error.message}`
      };
    }
  },

  /**
   * Validate that selected users exist and are valid
   * @param {Array} selectedUserIds - Array of user IDs to validate
   * @returns {Object} Validation result with user details
   */
  async validateSelectedUsers(selectedUserIds) {
    try {
      if (!selectedUserIds || !Array.isArray(selectedUserIds)) {
        return {
          success: false,
          error: 'Selected users must be an array'
        };
      }

      if (selectedUserIds.length === 0) {
        return {
          success: false,
          error: 'At least one user must be selected'
        };
      }

      // Check if all user IDs are valid
      for (const userId of selectedUserIds) {
        if (!isValidId(userId)) {
          return {
            success: false,
            error: `Invalid user ID: ${userId}`
          };
        }
      }

      // Check if all users exist in the database
      const users = await prisma.user.findMany({
        where: {
          id: { in: selectedUserIds }
        },
        select: {
          id: true,
          username: true
        }
      });

      const foundUserIds = users.map(user => user.id);
      const missingUsers = selectedUserIds.filter(id => 
        !foundUserIds.includes(id.toString())
      );

      if (missingUsers.length > 0) {
        return {
          success: false,
          error: `Users not found: ${missingUsers.join(', ')}`
        };
      }

      return {
        success: true,
        users: users
      };
    } catch (error) {
      return {
        success: false,
        error: `User validation error: ${error.message}`
      };
    }
  },

  /**
   * Check if a user follows another user
   * @param {String} followerId - ID of the potential follower
   * @param {String} followeeId - ID of the user being followed
   * @returns {Object} Result with following status
   */
  async checkFollowerRelationship(followerId, followeeId) {
    try {
      if (!followerId || !followeeId) {
        return {
          success: false,
          isFollowing: false,
          error: 'Both follower and followee IDs are required'
        };
      }

      if (followerId.toString() === followeeId.toString()) {
        return {
          success: true,
          isFollowing: true, // User "follows" themselves
          isSelf: true
        };
      }

      const followee = await prisma.user.findUnique({
        where: { id: followeeId },
        select: { followers: true }
      });

      if (!followee) {
        return {
          success: false,
          isFollowing: false,
          error: 'User not found'
        };
      }

      const followers = Array.isArray(followee.followers) ? followee.followers : [];
      const isFollowing = followers.some(id => 
        id.toString() === followerId.toString()
      );

      return {
        success: true,
        isFollowing: isFollowing
      };
    } catch (error) {
      return {
        success: false,
        isFollowing: false,
        error: `Relationship check error: ${error.message}`
      };
    }
  },

  /**
   * Get user relationships for privacy checking
   * @param {String} userId - ID of the user to get relationships for
   * @returns {Object} User relationships data
   */
  async getUserRelationships(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required'
        };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          followers: true,
          following: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const followers = Array.isArray(user.followers) ? user.followers : [];
      const following = Array.isArray(user.following) ? user.following : [];

      return {
        success: true,
        relationships: {
          followers: followers,
          following: following,
          followerCount: followers.length,
          followingCount: following.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching user relationships: ${error.message}`
      };
    }
  },

  /**
   * Create privacy audit log entry
   * @param {Object} post - Post object
   * @param {String} previousLevel - Previous privacy level
   * @param {String} newLevel - New privacy level
   * @param {String} updatedBy - ID of user making the change
   * @returns {Object} Audit log entry
   */
  createPrivacyAuditEntry(post, previousLevel, newLevel, updatedBy) {
    return {
      previousLevel: previousLevel,
      newLevel: newLevel,
      updatedAt: new Date(),
      updatedBy: updatedBy,
      postId: post.id || post._id // Handle both
    };
  },

  /**
   * Sanitize privacy settings for API response
   * @param {Object} privacySettings - Privacy settings object
   * @param {String} requestingUserId - ID of user requesting the data
   * @param {String} postCreatorId - ID of post creator
   * @returns {Object} Sanitized privacy settings
   */
  sanitizePrivacySettings(privacySettings, requestingUserId, postCreatorId) {
    if (!privacySettings) {
      return { level: 'public' };
    }

    // Post creator can see full privacy settings
    if (requestingUserId && requestingUserId.toString() === postCreatorId.toString()) {
      return privacySettings;
    }

    // Other users only see the privacy level, not selected users or audit trail
    return {
      level: privacySettings.level || 'public'
    };
  },

  /**
   * Get privacy level display name for UI
   * @param {String} privacyLevel - Privacy level code
   * @returns {String} Human-readable privacy level name
   */
  getPrivacyDisplayName(privacyLevel) {
    const displayNames = {
      'public': 'Public',
      'followers': 'Followers Only',
      'select_users': 'Selected Users',
      'only_me': 'Only Me'
    };

    return displayNames[privacyLevel] || 'Unknown';
  },

  /**
   * Check if privacy level allows public visibility
   * @param {String} privacyLevel - Privacy level to check
   * @returns {Boolean} True if publicly visible
   */
  isPubliclyVisible(privacyLevel) {
    return !privacyLevel || privacyLevel === 'public';
  },

  /**
   * Get privacy restrictions for a given level
   * @param {String} privacyLevel - Privacy level
   * @returns {Object} Privacy restrictions description
   */
  getPrivacyRestrictions(privacyLevel) {
    const restrictions = {
      'public': {
        description: 'Visible to everyone',
        canView: 'all_users',
        requiresAuth: false
      },
      'followers': {
        description: 'Visible to followers only',
        canView: 'followers',
        requiresAuth: true
      },
      'select_users': {
        description: 'Visible to selected users only',
        canView: 'selected_users',
        requiresAuth: true
      },
      'only_me': {
        description: 'Visible to creator only',
        canView: 'creator_only',
        requiresAuth: true
      }
    };

    return restrictions[privacyLevel] || restrictions['public'];
  }
};

export default privacyUtils;