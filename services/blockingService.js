import User from '../models/User.js';
import mongoose from 'mongoose';
import SecurityLogger from './securityLogger.js';

/**
 * Service for managing user blocking functionality
 */
class BlockingService {
  /**
   * Block a user
   * @param {string} blockerId - ID of user doing the blocking
   * @param {string} blockedId - ID of user being blocked
   * @param {string} reason - Optional reason for blocking
   * @param {Object} req - Express request object for logging
   * @returns {Promise<Object>} Result of blocking operation
   */
  async blockUser(blockerId, blockedId, reason = '', req = null) {
    try {
      if (blockerId === blockedId) {
        const error = new Error('Cannot block yourself');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const blocker = await User.findById(blockerId);
      if (!blocker) {
        const error = new Error('Blocker user not found');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const blocked = await User.findById(blockedId);
      if (!blocked) {
        const error = new Error('User to block not found');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      // Check if already blocked
      const existingBlock = blocker.blockedUsers?.find(
        block => block.user.toString() === blockedId
      );

      if (existingBlock) {
        const error = new Error('User is already blocked');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      // Add to blocked users list
      if (!blocker.blockedUsers) {
        blocker.blockedUsers = [];
      }

      blocker.blockedUsers.push({
        user: blockedId,
        blockedAt: new Date(),
        reason: reason
      });

      await blocker.save();

      // Log successful block event
      await SecurityLogger.logBlockEvent(blockerId, blockedId, req, true, null, { reason });

      return {
        success: true,
        message: 'User blocked successfully',
        blockedUser: {
          id: blocked._id,
          username: blocked.username,
          blockedAt: new Date()
        }
      };
    } catch (error) {
      // Log failed block event if not already logged
      if (!error.message.includes('Cannot block yourself') && 
          !error.message.includes('not found') && 
          !error.message.includes('already blocked')) {
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
      }
      throw error;
    }
  }

  /**
   * Unblock a user
   * @param {string} blockerId - ID of user doing the unblocking
   * @param {string} blockedId - ID of user being unblocked
   * @param {Object} req - Express request object for logging
   * @returns {Promise<Object>} Result of unblocking operation
   */
  async unblockUser(blockerId, blockedId, req = null) {
    try {
      const blocker = await User.findById(blockerId);
      if (!blocker) {
        const error = new Error('User not found');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      if (!blocker.blockedUsers || blocker.blockedUsers.length === 0) {
        const error = new Error('User is not blocked');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const blockIndex = blocker.blockedUsers.findIndex(
        block => block.user.toString() === blockedId
      );

      if (blockIndex === -1) {
        const error = new Error('User is not blocked');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      blocker.blockedUsers.splice(blockIndex, 1);
      await blocker.save();

      // Log successful unblock event
      await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, true);

      return {
        success: true,
        message: 'User unblocked successfully'
      };
    } catch (error) {
      // Log failed unblock event if not already logged
      if (!error.message.includes('not found') && !error.message.includes('not blocked')) {
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
      }
      throw error;
    }
  }

  /**
   * Check if one user has blocked another
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<boolean>} True if userId1 has blocked userId2
   */
  async isBlocked(userId1, userId2) {
    const user = await User.findById(userId1);
    if (!user || !user.blockedUsers) {
      return false;
    }

    return user.blockedUsers.some(
      block => block.user.toString() === userId2
    );
  }

  /**
   * Get list of blocked users for a user
   * @param {string} userId - User ID
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of results per page
   * @returns {Promise<Object>} Paginated list of blocked users
   */
  async getBlockedUsers(userId, page = 1, limit = 20) {
    const user = await User.findById(userId)
      .populate('blockedUsers.user', 'username profilePicture')
      .exec();

    if (!user) {
      throw new Error('User not found');
    }

    const blockedUsers = user.blockedUsers || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedBlocks = blockedUsers.slice(startIndex, endIndex);

    return {
      blockedUsers: paginatedBlocks.map(block => ({
        id: block.user._id,
        username: block.user.username,
        profilePicture: block.user.profilePicture,
        blockedAt: block.blockedAt,
        reason: block.reason
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(blockedUsers.length / limit),
        totalCount: blockedUsers.length,
        hasNext: endIndex < blockedUsers.length,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Enforce blocking rules - check if interaction is allowed
   * @param {string} currentUserId - Current user ID
   * @param {string} targetUserId - Target user ID
   * @returns {Promise<boolean>} True if interaction is allowed
   */
  async enforceBlockingRules(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId) {
      return true; // Allow if either user is not specified
    }

    if (currentUserId === targetUserId) {
      return true; // Allow self-interaction
    }

    // Check if either user has blocked the other
    const currentUserBlocked = await this.isBlocked(currentUserId, targetUserId);
    const targetUserBlocked = await this.isBlocked(targetUserId, currentUserId);

    return !currentUserBlocked && !targetUserBlocked;
  }
}

export default new BlockingService();