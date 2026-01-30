import BlockingService from '../services/blockingService.js';
import { prisma } from "../config/db.js";

/**
 * Middleware to enforce blocking relationships across all endpoints
 * Prevents blocked users from interacting with each other
 */
class BlockingMiddleware {
  /**
   * Middleware to check if users can interact based on blocking relationships
   * Blocks access if either user has blocked the other
   * @param {string} targetUserParam - Parameter name containing target user ID (default: 'userId')
   * @returns {Function} Express middleware function
   */
  static checkBlockingRelationship(targetUserParam = 'userId') {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const targetUserId = req.params[targetUserParam] || req.body[targetUserParam];

        // Skip check if no authenticated user or no target user
        if (!currentUserId || !targetUserId) {
          return next();
        }

        // Skip check if user is interacting with themselves
        if (currentUserId.toString() === targetUserId.toString()) {
          return next();
        }

        // Check if interaction is allowed
        const canInteract = await BlockingService.enforceBlockingRules(currentUserId, targetUserId);
        
        if (!canInteract) {
          return res.status(403).json({
            success: false,
            message: 'Interaction not allowed due to blocking relationship'
          });
        }

        next();
      } catch (error) {
        console.error('Blocking middleware error:', error);
        // Continue with request rather than failing on middleware error
        next();
      }
    };
  }

  /**
   * Middleware to filter content based on blocking relationships
   * Removes content from blocked users in arrays of posts, comments, etc.
   * @param {string} contentField - Field name in res.locals containing content array
   * @param {string} authorField - Field path to author ID in content objects (default: 'user._id')
   * @returns {Function} Express middleware function
   */
  static filterBlockedContent(contentField = 'posts', authorField = 'user._id') {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const content = res.locals[contentField];

        // Skip filtering if no authenticated user or no content
        if (!currentUserId || !content || !Array.isArray(content)) {
          return next();
        }

        // Filter out content from blocked users
        const filteredContent = [];
        
        for (const item of content) {
          // Handle Prisma objects where user is an object or a direct relation ID
          let authorId = null;
          
          if (authorField.includes('.')) {
            const parts = authorField.split('.');
            // Handle simple nesting like 'user.id'
            if (parts.length === 2 && item[parts[0]]) {
               authorId = item[parts[0]][parts[1]];
            }
          } else {
            authorId = item[authorField];
          }
          
          // Fallback for Mongoose style 'user._id' if we passed 'user.id' but it's not there
          if (!authorId && item.user && item.user.id) {
             authorId = item.user.id;
          }
          if (!authorId && item.userId) {
             authorId = item.userId;
          }

          if (!authorId) {
            filteredContent.push(item);
            continue;
          }

          const canInteract = await BlockingService.enforceBlockingRules(currentUserId, authorId.toString());
          if (canInteract) {
            filteredContent.push(item);
          }
        }

        res.locals[contentField] = filteredContent;
        next();
      } catch (error) {
        console.error('Content filtering middleware error:', error);
        // Continue with unfiltered content rather than failing
        next();
      }
    };
  }

  /**
   * Middleware to check if user can view another user's profile
   * @returns {Function} Express middleware function
   */
  static checkProfileAccess() {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const profileUserId = req.params.userId || req.params.id;

        // Allow access if no authenticated user (public profiles)
        if (!currentUserId) {
          return next();
        }

        // Allow access to own profile
        if (currentUserId.toString() === profileUserId.toString()) {
          return next();
        }

        // Check blocking relationship
        const canInteract = await BlockingService.enforceBlockingRules(currentUserId, profileUserId);
        
        if (!canInteract) {
          return res.status(403).json({
            success: false,
            message: 'Profile access denied due to blocking relationship'
          });
        }

        next();
      } catch (error) {
        console.error('Profile access middleware error:', error);
        // Continue with request rather than failing
        next();
      }
    };
  }

  /**
   * Middleware to check if user can send messages to another user
   * @returns {Function} Express middleware function
   */
  static checkMessagingAccess() {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const recipientId = req.params.recipientId || req.body.recipientId || req.body.recipient;

        if (!currentUserId || !recipientId) {
          return next();
        }

        // Skip check if user is messaging themselves (notes, etc.)
        if (currentUserId.toString() === recipientId.toString()) {
          return next();
        }

        // Check blocking relationship
        const canInteract = await BlockingService.enforceBlockingRules(currentUserId, recipientId);
        
        if (!canInteract) {
          return res.status(403).json({
            success: false,
            message: 'Cannot send message due to blocking relationship'
          });
        }

        next();
      } catch (error) {
        console.error('Messaging access middleware error:', error);
        // Continue with request rather than failing
        next();
      }
    };
  }

  /**
   * Middleware to check if user can interact with posts (like, comment, share)
   * @returns {Function} Express middleware function
   */
  static checkPostInteraction() {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const postId = req.params.postId || req.params.id;

        if (!currentUserId || !postId) {
          return next();
        }

        // Get post to find author using Prisma
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { userId: true }
        });
        
        if (!post) {
          return res.status(404).json({
            success: false,
            message: 'Post not found'
          });
        }

        const postAuthorId = post.userId;

        // Allow interaction with own posts
        if (currentUserId.toString() === postAuthorId) {
          return next();
        }

        // Check blocking relationship
        const canInteract = await BlockingService.enforceBlockingRules(currentUserId, postAuthorId);
        
        if (!canInteract) {
          return res.status(403).json({
            success: false,
            message: 'Cannot interact with post due to blocking relationship'
          });
        }

        next();
      } catch (error) {
        console.error('Post interaction middleware error:', error);
        // Continue with request rather than failing
        next();
      }
    };
  }

  /**
   * Middleware to check if user can follow/unfollow another user
   * @returns {Function} Express middleware function
   */
  static checkFollowAccess() {
    return async (req, res, next) => {
      try {
        const currentUserId = req.user?.id || req.user?._id;
        const targetUserId = req.params.userId || req.params.id;

        if (!currentUserId || !targetUserId) {
          return next();
        }

        // Cannot follow yourself
        if (currentUserId.toString() === targetUserId.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Cannot follow yourself'
          });
        }

        // Check blocking relationship
        const canInteract = await BlockingService.enforceBlockingRules(currentUserId, targetUserId);
        
        if (!canInteract) {
          return res.status(403).json({
            success: false,
            message: 'Cannot follow user due to blocking relationship'
          });
        }

        next();
      } catch (error) {
        console.error('Follow access middleware error:', error);
        // Continue with request rather than failing
        next();
      }
    };
  }

  /**
   * Helper method to get nested object values using dot notation
   * @param {Object} obj - Object to get value from
   * @param {string} path - Dot notation path (e.g., 'user.id')
   * @returns {*} Value at the specified path
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
}

export default BlockingMiddleware;
