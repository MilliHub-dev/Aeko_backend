import User from '../models/User.js';
import mongoose from 'mongoose';
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        const error = new Error('Invalid user ID');
        await SecurityLogger.logPrivacyChangeEvent(userId, req, false, error.message);
        throw error;
      }

      const user = await User.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        await SecurityLogger.logPrivacyChangeEvent(userId, req, false, error.message);
        throw error;
      }

      // Store previous settings for logging
      const previousSettings = { ...user.privacy.toObject() };

      // Validate privacy settings
      const validSettings = {};
      
      if (typeof settings.isPrivate === 'boolean') {
        validSettings['privacy.isPrivate'] = settings.isPrivate;
      }
      
      if (typeof settings.allowFollowRequests === 'boolean') {
        validSettings['privacy.allowFollowRequests'] = settings.allowFollowRequests;
      }
      
      if (typeof settings.showOnlineStatus === 'boolean') {
        validSettings['privacy.showOnlineStatus'] = settings.showOnlineStatus;
      }
      
      if (settings.allowDirectMessages && ['everyone', 'followers', 'none'].includes(settings.allowDirectMessages)) {
        validSettings['privacy.allowDirectMessages'] = settings.allowDirectMessages;
      }

      // Update user privacy settings
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: validSettings },
        { new: true, select: 'privacy' }
      );

      // Log successful privacy change
      await SecurityLogger.logPrivacyChangeEvent(userId, req, true, null, {
        changes: validSettings,
        previousSettings,
        newSettings: updatedUser.privacy.toObject()
      });

      return updatedUser.privacy;
    } catch (error) {
      // Log failed privacy change if not already logged
      if (!error.message.includes('Invalid user ID') && !error.message.includes('User not found')) {
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
      // Users can always view their own profile
      if (viewerId === profileId) {
        return true;
      }

      const profileUser = await User.findById(profileId).select('privacy followers blockedUsers');
      if (!profileUser) {
        return false;
      }

      // Check if viewer is blocked by profile owner
      const isBlocked = profileUser.blockedUsers.some(
        blocked => blocked.user.toString() === viewerId
      );
      if (isBlocked) {
        return false;
      }

      // If account is not private, profile can be viewed
      if (!profileUser.privacy.isPrivate) {
        return true;
      }

      // For private accounts, check if viewer is a follower
      const isFollower = profileUser.followers.includes(viewerId);
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
      // Users can always view their own posts
      if (viewerId === authorId) {
        return true;
      }

      const authorUser = await User.findById(authorId).select('privacy followers blockedUsers');
      if (!authorUser) {
        return false;
      }

      // Check if viewer is blocked by author
      const isBlocked = authorUser.blockedUsers.some(
        blocked => blocked.user.toString() === viewerId
      );
      if (isBlocked) {
        return false;
      }

      // If account is not private, posts can be viewed
      if (!authorUser.privacy.isPrivate) {
        return true;
      }

      // For private accounts, check if viewer is a follower
      const isFollower = authorUser.followers.includes(viewerId);
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
      // Users cannot message themselves
      if (senderId === recipientId) {
        return false;
      }

      const recipientUser = await User.findById(recipientId).select('privacy followers blockedUsers');
      if (!recipientUser) {
        return false;
      }

      // Check if sender is blocked by recipient
      const isBlocked = recipientUser.blockedUsers.some(
        blocked => blocked.user.toString() === senderId
      );
      if (isBlocked) {
        return false;
      }

      // Check recipient's message settings
      const messageSettings = recipientUser.privacy.allowDirectMessages;
      
      switch (messageSettings) {
        case 'none':
          return false;
        case 'everyone':
          return true;
        case 'followers':
          // Check if sender is a follower
          return recipientUser.followers.includes(senderId);
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
      if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(targetId)) {
        const error = new Error('Invalid user ID');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Users cannot follow themselves
      if (requesterId === targetId) {
        const error = new Error('Cannot send follow request to yourself');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      const [requester, target] = await Promise.all([
        User.findById(requesterId).select('username'),
        User.findById(targetId).select('privacy followRequests followers blockedUsers')
      ]);

      if (!requester || !target) {
        const error = new Error('User not found');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if requester is blocked by target
      const isBlocked = target.blockedUsers.some(
        blocked => blocked.user.toString() === requesterId
      );
      if (isBlocked) {
        const error = new Error('Cannot send follow request to this user');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if already following
      if (target.followers.includes(requesterId)) {
        const error = new Error('Already following this user');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // If account is not private, follow directly
      if (!target.privacy.isPrivate) {
        // Add to followers
        await User.findByIdAndUpdate(targetId, {
          $addToSet: { followers: requesterId }
        });
        
        // Add to following
        await User.findByIdAndUpdate(requesterId, {
          $addToSet: { following: targetId }
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
      if (!target.privacy.allowFollowRequests) {
        const error = new Error('This user is not accepting follow requests');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Check if request already exists
      const existingRequest = target.followRequests.find(
        req => req.user.toString() === requesterId && req.status === 'pending'
      );
      if (existingRequest) {
        const error = new Error('Follow request already sent');
        await SecurityLogger.logFollowRequestSentEvent(requesterId, targetId, req, false, error.message);
        throw error;
      }

      // Add follow request
      await User.findByIdAndUpdate(targetId, {
        $push: {
          followRequests: {
            user: requesterId,
            requestedAt: new Date(),
            status: 'pending'
          }
        }
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
      if (!error.message.includes('Invalid user ID') && 
          !error.message.includes('Cannot send follow request') && 
          !error.message.includes('User not found') &&
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
      if (!mongoose.Types.ObjectId.isValid(targetId) || !mongoose.Types.ObjectId.isValid(requesterId)) {
        const error = new Error('Invalid user ID');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      if (!['approve', 'reject'].includes(action)) {
        const error = new Error('Invalid action. Must be "approve" or "reject"');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      const target = await User.findById(targetId).select('followRequests followers');
      if (!target) {
        const error = new Error('User not found');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      // Find the follow request
      const requestIndex = target.followRequests.findIndex(
        req => req.user.toString() === requesterId && req.status === 'pending'
      );

      if (requestIndex === -1) {
        const error = new Error('Follow request not found');
        const logMethod = action === 'approve' ? 'logFollowRequestApprovedEvent' : 'logFollowRequestRejectedEvent';
        await SecurityLogger[logMethod](targetId, requesterId, req, false, error.message);
        throw error;
      }

      if (action === 'approve') {
        // Add to followers
        await User.findByIdAndUpdate(targetId, {
          $addToSet: { followers: requesterId },
          $pull: { followRequests: { user: requesterId } }
        });
        
        // Add to following
        await User.findByIdAndUpdate(requesterId, {
          $addToSet: { following: targetId }
        });

        // Log successful approval
        await SecurityLogger.logFollowRequestApprovedEvent(targetId, requesterId, req, true);

        return {
          success: true,
          message: 'Follow request approved',
          action: 'approved'
        };
      } else {
        // Remove the request
        await User.findByIdAndUpdate(targetId, {
          $pull: { followRequests: { user: requesterId } }
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
      if (!error.message.includes('Invalid user ID') && 
          !error.message.includes('Invalid action') && 
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }

      const user = await User.findById(userId).select('followRequests');
      if (!user) {
        throw new Error('User not found');
      }

      let requests = user.followRequests;

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
      const populatedRequests = await User.populate(paginatedRequests, {
        path: 'user',
        select: 'username name profilePicture'
      });

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