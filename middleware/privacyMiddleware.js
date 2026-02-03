import { prisma } from "../config/db.js";
import SecurityLogger from '../services/securityLogger.js';

class PrivacyMiddleware {
  /**
   * Filter posts based on privacy settings and user relationship
   */
  async filterPosts(posts, requestingUserId) {
    if (!posts || posts.length === 0) {
      return [];
    }

    if (!requestingUserId) {
      // If no user is requesting, only return public posts
      return posts.filter(post => {
        const privacy = post.privacy || {};
        return privacy.level === 'public' || !privacy.level;
      });
    }

    // Get requesting user's following list for follower checks
    // In Prisma schema, 'following' is a Json field (array of strings)
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { following: true }
    });
    
    // Default to empty array if user not found or following is null
    const followingIds = (requestingUser?.following || []).map(id => id.toString());

    // Filter posts based on privacy settings
    const accessiblePosts = posts.filter(post => {
      return this.canUserAccessPost(post, requestingUserId, followingIds);
    });

    return accessiblePosts;
  }

  /**
   * Check if a specific user can access a post
   */
  canUserAccessPost(post, requestingUserId, followingIds = null) {
    const privacy = post.privacy || {};
    
    // Handle posts without privacy settings (legacy posts default to public)
    if (!privacy.level) {
      return true;
    }

    // Post creator can always access their own posts
    // Handle both object structure (if included) or ID string
    const postCreatorId = post.userId || post.user?.id || post.user;
    
    if (postCreatorId && requestingUserId && postCreatorId.toString() === requestingUserId.toString()) {
      return true;
    }

    switch (privacy.level) {
      case 'public':
        return true;
      
      case 'only_me':
        return false;
      
      case 'followers':
        // Check if requesting user follows the post creator
        if (followingIds) {
          return followingIds.includes(postCreatorId?.toString());
        }
        // If followingIds not provided, we rely on caller or default to deny for safety if logic requires list
        // Note: For synchronous checks without list, we can't verify relationship easily.
        // Assuming strict secure default.
        return false;
      
      case 'select_users':
        // Check if requesting user is in the selected users list
        const selectedUsers = privacy.selectedUsers || [];
        const selectedUserIds = selectedUsers.map(u => 
          (typeof u === 'object' ? u.id : u).toString()
        );
        return selectedUserIds.includes(requestingUserId.toString());
      
      default:
        return false;
    }
  }

  /**
   * Check follower relationship (async helper)
   */
  async checkFollowerRelationship(followerId, targetId) {
    if (!followerId || !targetId) return false;
    
    const user = await prisma.user.findUnique({
      where: { id: followerId },
      select: { following: true }
    });

    const following = user?.following || [];
    return following.includes(targetId.toString());
  }

  /**
   * Middleware to filter response posts
   * Intercepts res.json to filter posts before sending to client
   */
  filterResponsePosts = async (req, res, next) => {
    const originalJson = res.json;
    const self = this;

    res.json = async function(data) {
      try {
        // Only filter if we have data and it looks like posts
        
        let postsToFilter = [];
        let isSinglePost = false;

        // Check structure of data
        if (Array.isArray(data)) {
          // Array of objects that look like posts (have id, content or media)
          if (data.length > 0 && (data[0].content !== undefined || data[0].media !== undefined)) {
             postsToFilter = data;
          }
        } else if (data && data.posts && Array.isArray(data.posts)) {
          postsToFilter = data.posts;
        } else if (data && data.id && (data.content !== undefined || data.media !== undefined)) {
          // Single post object
          postsToFilter = [data];
          isSinglePost = true;
        }

        // If we found posts to filter
        if (postsToFilter.length > 0) {
          const userId = req.user ? req.user.id : null;
          const filtered = await self.filterPosts(postsToFilter, userId);
          
          if (isSinglePost) {
            if (filtered.length === 0) {
              // If it was a single post and user can't access it
              return res.status(403).send({ error: 'Access denied' });
            }
            // If it was a single post and passed filter
            // We return the data as is (since filterPosts doesn't modify individual post content currently)
            return originalJson.call(this, data);
          } else {
            // Update the data with filtered list
            if (Array.isArray(data)) {
              return originalJson.call(this, filtered);
            } else {
              data.posts = filtered;
              return originalJson.call(this, data);
            }
          }
        }
      } catch (error) {
        console.error('Error filtering posts:', error);
      }

      // Default: return original data
      return originalJson.call(this, data);
    };

    next();
  }

  /**
   * Middleware to check access to a specific post ID in params
   */
  checkPostAccess = async (req, res, next) => {
    try {
      const postId = req.params.postId || req.params.id;
      if (!postId) return next();

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { user: { select: { id: true } } }
      });

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const userId = req.user ? req.user.id : null;
      
      // Get following list if user is logged in
      let followingIds = [];
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { following: true }
        });
        followingIds = (user?.following || []).map(id => id.toString());
      }

      const hasAccess = this.canUserAccessPost(post, userId, followingIds);

      if (!hasAccess) {
        await SecurityLogger.logAccessControlEvent(
          userId || 'anonymous',
          'POST_ACCESS_DENIED', 
          'READ', 
          false, 
          { postId, privacy: post.privacy }
        );
        return res.status(403).json({ message: 'Access denied to this post' });
      }

      // Attach post to request for reuse
      req.post = post;
      next();
    } catch (error) {
      console.error('Check post access error:', error);
      next(error);
    }
  }

  /**
   * Check if a profile is accessible
   */
  checkProfileAccess = async (req, res, next) => {
    try {
      const targetUserId = req.params.userId || req.params.id;
      if (!targetUserId) return next();

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          privacy: true,
          blockedUsers: true
        }
      });

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const requestingUserId = req.user ? req.user.id : null;

      // 1. Check if blocked
      const blockedUsers = targetUser.blockedUsers || [];
      if (requestingUserId && blockedUsers.includes(requestingUserId)) {
        return res.status(403).json({ message: 'You are blocked by this user' });
      }

      // 2. Check profile privacy
      const privacy = targetUser.privacy || {};
      const isPrivate = privacy.isPrivate || false;
      
      // If public or accessing own profile, allow
      if (!isPrivate || (requestingUserId && requestingUserId === targetUserId)) {
        return next();
      }

      // If private, check if following
      if (requestingUserId) {
        const relationship = await this.checkFollowerRelationship(requestingUserId, targetUserId);
        if (relationship) {
          return next();
        }
      }

      return res.status(403).json({ message: 'This account is private' });
    } catch (error) {
      console.error('Check profile access error:', error);
      next(error);
    }
  }
  
  /**
   * Middleware specifically for post viewing
   */
  checkPostViewAccess = async (req, res, next) => {
    // This is often an alias or similar to checkPostAccess but might have different nuances
    // For now, we delegate to checkPostAccess
    return this.checkPostAccess(req, res, next);
  }
}

export default new PrivacyMiddleware();
