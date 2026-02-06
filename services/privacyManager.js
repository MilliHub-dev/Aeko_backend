import { prisma } from '../config/db.js';
import SecurityLogger from './securityLogger.js';

/**
 * Privacy Manager Service
 * Handles account privacy settings, access control, and follow request management
 */
class PrivacyManager {
  /**
   * Update user privacy settings
   * @param {string} userId - User ID
   * @param {Object} settings - Privacy settings to update
   * @param {Object} req - Express request object for logging
   * @returns {Promise<Object>} Updated privacy settings
   */
  async updatePrivacySettings(userId, settings, req = null) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { privacy: true }
      });

      if (!user) {
        const error = new Error('User not found');
        await SecurityLogger.logPrivacyChangeEvent(userId, req, false, error.message);
        throw error;
      }

      // Store previous settings for logging
      const previousSettings = user.privacy || {};

      // Validate and merge privacy settings
      const validSettings = { ...previousSettings };
      
      if (typeof settings.isPrivate === 'boolean') {
        validSettings.isPrivate = settings.isPrivate;
      }
      
      if (typeof settings.allowFollowRequests === 'boolean') {
        validSettings.allowFollowRequests = settings.allowFollowRequests;
      }
      
      if (typeof settings.showOnlineStatus === 'boolean') {
        validSettings.showOnlineStatus = settings.showOnlineStatus;
      }
      
      if (settings.allowDirectMessages && ['everyone', 'followers', 'none'].includes(settings.allowDirectMessages)) {
        validSettings.allowDirectMessages = settings.allowDirectMessages;
      }

      if (typeof settings.allowComments === 'boolean') {
        validSettings.allowComments = settings.allowComments;
      }

      if (typeof settings.allowTags === 'boolean') {
        validSettings.allowTags = settings.allowTags;
      }

      // Update user privacy settings
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { privacy: validSettings },
        select: { privacy: true }
      });

      // Log successful privacy change
      await SecurityLogger.logPrivacyChangeEvent(userId, req, true, null, {
        changes: settings,
        previousSettings,
        newSettings: updatedUser.privacy
      });

      return updatedUser.privacy;
    } catch (error) {
      // Log failed privacy change if not already logged
      if (!error.message.includes('User not found')) {
        await SecurityLogger.logPrivacyChangeEvent(userId, req, false, error.message);
      }
      throw new Error(`Failed to update privacy settings: ${error.message}`);
    }
  }

  /**
   * Check if a user can view another user's profile
   * @param {string} viewerId - ID of user trying to view profile
   * @param {string} profileId - ID of profile being viewed
   * @returns {Promise<boolean>} Whether profile can be viewed
   */
  async canViewProfile(viewerId, profileId) {
    try {
      if (!viewerId || !profileId) {
        return false;
      }

      // Users can always view their own profile
      if (viewerId === profileId) {
        return true;
      }

      const profileUser = await prisma.user.findUnique({
        where: { id: profileId },
        select: { privacy: true, followers: true, blockedUsers: true }
      });

      if (!profileUser) {
        return false;
      }

      // Check if viewer is blocked by profile owner
      const blockedUsers = Array.isArray(profileUser.blockedUsers) ? profileUser.blockedUsers : [];
      const isBlocked = blockedUsers.some(
        blocked => blocked.user === viewerId
      );
      if (isBlocked) {
        return false;
      }

      // If account is not private, profile can be viewed
      const privacy = profileUser.privacy || {};
      if (!privacy.isPrivate) {
        return true;
      }

      // For private accounts, check if viewer is a follower
      const followers = Array.isArray(profileUser.followers) ? profileUser.followers : [];
      const isFollower = followers.includes(viewerId);
      return isFollower;
    } catch (error) {
      console.error('Error checking profile view permission:', error);
      return false;
    }
  }

  /**
   * Check if a user can view another user's posts
   * @param {string} viewerId - ID of user trying to view posts
   * @param {string} authorId - ID of post author
   * @returns {Promise<boolean>} Whether posts can be viewed
   */
  async canViewPosts(viewerId, authorId) {
    try {
      if (!viewerId || !authorId) {
        return false;
      }

      // Users can always view their own posts
      if (viewerId === authorId) {
        return true;
      }

      const authorUser = await prisma.user.findUnique({
        where: { id: authorId },
        select: { privacy: true, followers: true, blockedUsers: true }
      });

      if (!authorUser) {
        return false;
      }

      // Check if viewer is blocked by author
      const blockedUsers = Array.isArray(authorUser.blockedUsers) ? authorUser.blockedUsers : [];
      const isBlocked = blockedUsers.some(
        blocked => blocked.user === viewerId
      );
      if (isBlocked) {
        return false;
      }

      // If account is not private, posts can be viewed
      const privacy = authorUser.privacy || {};
      if (!privacy.isPrivate) {
        return true;
      }

      // For private accounts, check if viewer is a follower
      const followers = Array.isArray(authorUser.followers) ? authorUser.followers : [];
      const isFollower = followers.includes(viewerId);
      return isFollower;
    } catch (error) {
      console.error('Error checking post view permission:', error);
      return false;
    }
  }

  /**
   * Check if a user can send messages to another user
   * @param {string} senderId - ID of user trying to send message
   * @param {string} recipientId - ID of message recipient
   * @returns {Promise<boolean>} Whether message can be sent
   */
  async canSendMessage(senderId, recipientId) {
    try {
      if (!senderId || !recipientId) {
        return false;
      }

      // Users cannot message themselves
      if (senderId === recipientId) {
        return false;
      }

      const recipientUser = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { privacy: true, followers: true, blockedUsers: true }
      });

      if (!recipientUser) {
        return false;
      }

      // Check if sender is blocked by recipient
      const blockedUsers = Array.isArray(recipientUser.blockedUsers) ? recipientUser.blockedUsers : [];
      const isBlocked = blockedUsers.some(
        blocked => blocked.user === senderId
      );
      if (isBlocked) {
        return false;
      }

      // Check recipient's message settings
      const privacy = recipientUser.privacy || {};
      const messageSettings = privacy.allowDirectMessages;
      
      switch (messageSettings) {
        case 'none':
          return false;
        case 'everyone':
          return true;
        case 'followers':
          // Check if sender is a follower
          const followers = Array.isArray(recipientUser.followers) ? recipientUser.followers : [];
          return followers.includes(senderId);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking message permission:', error);
      return false;
    }
  }

  /**
   * Send a follow request to a private account
   * @param {string} requesterId - ID of user sending request
   * @param {string} targetId - ID of user receiving request
   * @param {Object} req - Express request object for logging
   * @returns {Promise<Object>} Follow request result
   */
  async sendFollowRequest(requesterId, targetId, req = null) {
    try {
      // Users cannot follow themselves
      if (requesterId === targetId) {
        const error = new Error('Cannot send follow request to yourself');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      const [requester, target] = await Promise.all([
        prisma.user.findUnique({ where: { id: requesterId }, select: { username: true } }),
        prisma.user.findUnique({ where: { id: targetId }, select: { privacy: true, followRequests: true, followers: true, blockedUsers: true } })
      ]);

      if (!requester || !target) {
        const error = new Error('User not found');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if requester is blocked by target
      const blockedUsers = Array.isArray(target.blockedUsers) ? target.blockedUsers : [];
      const isBlocked = blockedUsers.some(
        blocked => blocked.user === requesterId
      );
      if (isBlocked) {
        const error = new Error('Cannot send follow request to this user');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if already following
      const followers = Array.isArray(target.followers) ? target.followers : [];
      if (followers.includes(requesterId)) {
        const error = new Error('Already following this user');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      const privacy = target.privacy || {};

      // If account is not private, follow directly
      if (!privacy.isPrivate) {
        // Add to followers
        const updatedFollowers = [...followers, requesterId];
        await prisma.user.update({
          where: { id: targetId },
          data: { followers: updatedFollowers }
        });
        
        // Add to following
        const requesterUser = await prisma.user.findUnique({ where: { id: requesterId }, select: { following: true } });
        const following = Array.isArray(requesterUser.following) ? requesterUser.following : [];
        const updatedFollowing = [...following, targetId];
        
        await prisma.user.update({
          where: { id: requesterId },
          data: { following: updatedFollowing }
        });

        // Log successful direct follow
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, true, null);

        return {
          success: true,
          message: 'Successfully followed user',
          type: 'direct_follow'
        };
      }

      // Check if follow requests are allowed
      if (privacy.allowFollowRequests === false) { // Strict check for false, undefined assumes true
        const error = new Error('This user is not accepting follow requests');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if request already exists
      const followRequests = Array.isArray(target.followRequests) ? target.followRequests : [];
      const existingRequest = followRequests.find(
        req => req.user === requesterId && req.status === 'pending'
      );
      if (existingRequest) {
        const error = new Error('Follow request already sent');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Add follow request
      const newRequest = {
        user: requesterId,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      const updatedFollowRequests = [...followRequests, newRequest];
      
      await prisma.user.update({
        where: { id: targetId },
        data: { followRequests: updatedFollowRequests }
      });

      // Log successful follow request
      await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, true);

      return {
        success: true,
        message: 'Follow request sent successfully',
        type: 'follow_request'
      };
    } catch (error) {
      // Log failed follow request if not already logged
      if (!error.message.includes('User not found') &&
          !error.message.includes('Cannot send follow request') &&
          !error.message.includes('Already following') &&
          !error.message.includes('not accepting') &&
          !error.message.includes('already sent')) {
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
      }
      throw new Error(`Failed to send follow request: ${error.message}`);
    }
  }

  /**
   * Handle a follow request (approve or reject)
   * @param {string} targetId - ID of user handling the request
   * @param {string} requesterId - ID of user who sent the request
   * @param {string} action - 'approve' or 'reject'
   * @param {Object} req - Express request object for logging
   * @returns {Promise<Object>} Request handling result
   */
  async handleFollowRequest(targetId, requesterId, action, req = null) {
    try {
      if (!['approve', 'reject'].includes(action)) {
        const error = new Error('Invalid action. Must be "approve" or "reject"');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: { followRequests: true, followers: true }
      });

      if (!target) {
        const error = new Error('User not found');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      // Find the follow request
      const followRequests = Array.isArray(target.followRequests) ? target.followRequests : [];
      const requestIndex = followRequests.findIndex(
        req => req.user === requesterId && req.status === 'pending'
      );

      if (requestIndex === -1) {
        const error = new Error('Follow request not found');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      if (action === 'approve') {
        // Add to followers
        const followers = Array.isArray(target.followers) ? target.followers : [];
        // Prevent duplicates
        const updatedFollowers = followers.includes(requesterId) ? followers : [...followers, requesterId];
        
        // Remove from followRequests
        const updatedFollowRequests = followRequests.filter(req => req.user !== requesterId);
        
        await prisma.user.update({
          where: { id: targetId },
          data: { 
            followers: updatedFollowers,
            followRequests: updatedFollowRequests
          }
        });
        
        // Add to following of requester
        const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { following: true } });
        if (requester) {
            const following = Array.isArray(requester.following) ? requester.following : [];
            const updatedFollowing = following.includes(targetId) ? following : [...following, targetId];
            
            await prisma.user.update({
                where: { id: requesterId },
                data: { following: updatedFollowing }
            });
        }

        // Log successful approval
        await SecurityLogger.logFollowRequestApprovedEvent(targetId, requesterId, req, true);

        return {
          success: true,
          message: 'Follow request approved',
          action: 'approved'
        };
      } else {
        // Remove the request
        const updatedFollowRequests = followRequests.filter(req => req.user !== requesterId);
        
        await prisma.user.update({
          where: { id: targetId },
          data: { followRequests: updatedFollowRequests }
        });

        // Log successful rejection
        await SecurityLogger.logFollowRequestRejectedEvent(targetId, requesterId, req, true);

        return {
          success: true,
          message: 'Follow request rejected',
          action: 'rejected'
        };
      }
    } catch (error) {
      // Log failed request handling if not already logged
      if (!error.message.includes('Invalid action') && 
          !error.message.includes('User not found') &&
          !error.message.includes('not found')) {
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
      }
      throw new Error(`Failed to handle follow request: ${error.message}`);
    }
  }

  /**
   * Get follow requests for a user
   * @param {string} userId - User ID
   * @param {string} status - Request status ('pending', 'approved', 'rejected', or 'all')
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of requests per page
   * @returns {Promise<Object>} Follow requests with pagination
   */
  async getFollowRequests(userId, status = 'pending', page = 1, limit = 20) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { followRequests: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      let requests = Array.isArray(user.followRequests) ? user.followRequests : [];

      // Filter by status if specified
      if (status !== 'all') {
        requests = requests.filter(req => req.status === status);
      }

      // Sort by request date (newest first)
      requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRequests = requests.slice(startIndex, endIndex);

      // Populate user details
      // In Prisma we need to fetch user details manually
      const userIds = paginatedRequests.map(req => req.user);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, name: true, profilePicture: true }
      });
      
      const userMap = users.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
      
      const populatedRequests = paginatedRequests.map(req => ({
        ...req,
        user: userMap[req.user] || { id: req.user, username: 'Unknown' }
      }));

      return {
        requests: populatedRequests,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(requests.length / limit),
          totalRequests: requests.length,
          hasNextPage: endIndex < requests.length,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to get follow requests: ${error.message}`);
    }
  }
}

export default new PrivacyManager();
