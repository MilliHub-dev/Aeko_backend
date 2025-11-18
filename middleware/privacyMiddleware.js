import mongoose from "mongoose";
import User from "../models/User.js";

/**
 * Privacy filtering middleware that filters posts based on requesting user's permissions
 * Implements follower relationship checking and selected users validation
 */
const privacyFilterMiddleware = {
  /**
   * Middleware function to filter posts array based on privacy settings
   * @param {Array} posts - Array of post objects to filter
   * @param {String} requestingUserId - ID of the user requesting the posts
   * @returns {Array} Filtered array of posts the user can access
   */
  async filterPosts(posts, requestingUserId) {
    if (!posts || posts.length === 0) {
      return [];
    }

    if (!requestingUserId) {
      // If no user is requesting, only return public posts
      return posts.filter(post => post.privacy?.level === 'public' || !post.privacy?.level);
    }

    // Get requesting user's following list for follower checks
    const requestingUser = await User.findById(requestingUserId).select('following');
    if (!requestingUser) {
      // If user not found, only return public posts
      return posts.filter(post => post.privacy?.level === 'public' || !post.privacy?.level);
    }

    const followingIds = requestingUser.following.map(id => id.toString());

    // Filter posts based on privacy settings
    const accessiblePosts = posts.filter(post => {
      return this.canUserAccessPost(post, requestingUserId, followingIds);
    });

    return accessiblePosts;
  },

  /**
   * Check if a user can access a specific post based on privacy settings
   * @param {Object} post - Post object to check access for
   * @param {String} requestingUserId - ID of the user requesting access
   * @param {Array} followingIds - Array of user IDs that the requesting user follows
   * @returns {Boolean} True if user can access the post
   */
  canUserAccessPost(post, requestingUserId, followingIds = null) {
    // Handle posts without privacy settings (legacy posts default to public)
    if (!post.privacy || !post.privacy.level) {
      return true;
    }

    // Post creator can always access their own posts
    const postCreatorId = post.user?._id?.toString() || post.user?.toString();
    if (postCreatorId === requestingUserId.toString()) {
      return true;
    }

    switch (post.privacy.level) {
      case 'public':
        return true;

      case 'only_me':
        return false;

      case 'followers':
        // Check if requesting user follows the post creator
        if (followingIds) {
          return followingIds.includes(postCreatorId);
        }
        // If followingIds not provided, we need to check directly
        return this.checkFollowerRelationship(requestingUserId, postCreatorId);

      case 'select_users':
        // Check if requesting user is in the selected users list
        const selectedUserIds = (post.privacy.selectedUsers || []).map(id => 
          id._id?.toString() || id.toString()
        );
        return selectedUserIds.includes(requestingUserId.toString());

      default:
        return false;
    }
  },

  /**
   * Check if a user follows another user (fallback method)
   * @param {String} followerId - ID of the potential follower
   * @param {String} followeeId - ID of the user being followed
   * @returns {Boolean} True if follower follows followee
   */
  async checkFollowerRelationship(followerId, followeeId) {
    try {
      const followee = await User.findById(followeeId).select('followers');
      if (!followee) return false;
      
      return followee.followers.some(id => id.toString() === followerId.toString());
    } catch (error) {
      console.error('Error checking follower relationship:', error);
      return false;
    }
  },

  /**
   * Express middleware wrapper for filtering posts in response
   * Automatically filters posts in res.locals.posts or specified field
   * @param {String} postsField - Field name in res.locals containing posts (default: 'posts')
   */
  filterResponsePosts(postsField = 'posts') {
    return async (req, res, next) => {
      try {
        const posts = res.locals[postsField];
        if (!posts) {
          return next();
        }

        const requestingUserId = req.user?._id || req.userId;
        const filteredPosts = await this.filterPosts(posts, requestingUserId);
        
        res.locals[postsField] = filteredPosts;
        next();
      } catch (error) {
        console.error('Privacy filter middleware error:', error);
        // Continue with unfiltered posts rather than failing the request
        next();
      }
    };
  },

  /**
   * Middleware to check access to a single post
   * Expects post to be in res.locals.post
   */
  checkPostAccess() {
    return async (req, res, next) => {
      try {
        const post = res.locals.post;
        if (!post) {
          return res.status(404).json({
            success: false,
            error: "Post not found"
          });
        }

        const requestingUserId = req.user?._id || req.userId;
        if (!requestingUserId) {
          // Check if post is public for unauthenticated users
          if (post.privacy?.level === 'public' || !post.privacy?.level) {
            return next();
          }
          return res.status(401).json({
            success: false,
            error: "Authentication required to view this post"
          });
        }

        const canAccess = await this.canUserAccessPost(post, requestingUserId);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: "You don't have permission to view this post"
          });
        }

        next();
      } catch (error) {
        console.error('Post access check error:', error);
        res.status(500).json({
          success: false,
          error: "Internal server error"
        });
      }
    };
  },

  /**
   * Build MongoDB query for posts accessible by a specific user
   * @param {String} requestingUserId - ID of the user requesting posts
   * @returns {Object} MongoDB query object for accessible posts
   */
  async buildAccessQuery(requestingUserId) {
    if (!requestingUserId) {
      // Return query for public posts only
      return {
        $or: [
          { 'privacy.level': 'public' },
          { 'privacy.level': { $exists: false } }, // Legacy posts without privacy
          { privacy: { $exists: false } } // Posts without privacy field
        ]
      };
    }

    // Get user's following list
    const requestingUser = await User.findById(requestingUserId).select('following');
    const followingIds = requestingUser ? requestingUser.following : [];

    const query = {
      $or: [
        // Public posts
        { 'privacy.level': 'public' },
        // Legacy posts without privacy (default to public)
        { 'privacy.level': { $exists: false } },
        { privacy: { $exists: false } },
        // User's own posts
        { user: requestingUserId },
        // Posts where user is in selectedUsers
        { 
          'privacy.level': 'select_users',
          'privacy.selectedUsers': requestingUserId 
        }
      ]
    };

    // Add followers-only posts if user follows the creators
    if (followingIds.length > 0) {
      query.$or.push({
        'privacy.level': 'followers',
        user: { $in: followingIds }
      });
    }

    return query;
  }
};

/**
 * Middleware to check if user can view another user's profile
 * Uses PrivacyManager service for access control
 */
const checkProfileAccess = () => {
  return async (req, res, next) => {
    try {
      const viewerId = req.user?._id || req.userId;
      const profileId = req.params.id || req.params.userId;

      if (!viewerId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required"
        });
      }

      if (!profileId) {
        return res.status(400).json({
          success: false,
          error: "Profile ID is required"
        });
      }

      // Import PrivacyManager dynamically to avoid circular imports
      const PrivacyManager = (await import('../services/privacyManager.js')).default;
      
      const canView = await PrivacyManager.canViewProfile(viewerId, profileId);
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to view this profile"
        });
      }

      next();
    } catch (error) {
      console.error('Profile access check error:', error);
      res.status(500).json({
        success: false,
        error: "Internal server error"
      });
    }
  };
};

/**
 * Middleware to check if user can view another user's posts
 * Uses PrivacyManager service for access control
 */
const checkPostViewAccess = () => {
  return async (req, res, next) => {
    try {
      const viewerId = req.user?._id || req.userId;
      const authorId = req.params.userId;

      if (!viewerId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required"
        });
      }

      if (!authorId) {
        return res.status(400).json({
          success: false,
          error: "Author ID is required"
        });
      }

      // Import PrivacyManager dynamically to avoid circular imports
      const PrivacyManager = (await import('../services/privacyManager.js')).default;
      
      const canView = await PrivacyManager.canViewPosts(viewerId, authorId);
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to view this user's posts"
        });
      }

      next();
    } catch (error) {
      console.error('Post view access check error:', error);
      res.status(500).json({
        success: false,
        error: "Internal server error"
      });
    }
  };
};

// Add the new middleware functions to the export
privacyFilterMiddleware.checkProfileAccess = checkProfileAccess;
privacyFilterMiddleware.checkPostViewAccess = checkPostViewAccess;

export default privacyFilterMiddleware;