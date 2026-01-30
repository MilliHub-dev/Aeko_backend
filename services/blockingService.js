import { prisma } from "../config/db.js";
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

      const blocker = await prisma.user.findUnique({
        where: { id: blockerId },
        select: { id: true, blockedUsers: true, username: true }
      });

      if (!blocker) {
        const error = new Error('Blocker user not found');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const blocked = await prisma.user.findUnique({
        where: { id: blockedId },
        select: { id: true, username: true }
      });

      if (!blocked) {
        const error = new Error('User to block not found');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      // Check if already blocked
      // blockedUsers is a JSON array
      const currentBlockedUsers = Array.isArray(blocker.blockedUsers) ? blocker.blockedUsers : [];
      
      const existingBlock = currentBlockedUsers.find(
        block => (block.user === blockedId || block.user?.id === blockedId || block.userId === blockedId)
      );

      if (existingBlock) {
        const error = new Error('User is already blocked');
        await SecurityLogger.logBlockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      // Add to blocked users list
      const newBlock = {
        user: blockedId,
        blockedAt: new Date(),
        reason: reason
      };

      const updatedBlockedUsers = [...currentBlockedUsers, newBlock];

      await prisma.user.update({
        where: { id: blockerId },
        data: { blockedUsers: updatedBlockedUsers }
      });

      // Log successful block event
      await SecurityLogger.logBlockEvent(blockerId, blockedId, req, true, null, { reason });

      return {
        success: true,
        message: 'User blocked successfully',
        blockedUser: {
          id: blocked.id,
          username: blocked.username,
          blockedAt: newBlock.blockedAt
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
      const blocker = await prisma.user.findUnique({
        where: { id: blockerId },
        select: { id: true, blockedUsers: true }
      });

      if (!blocker) {
        const error = new Error('User not found');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const currentBlockedUsers = Array.isArray(blocker.blockedUsers) ? blocker.blockedUsers : [];

      if (currentBlockedUsers.length === 0) {
        const error = new Error('User is not blocked');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      const blockIndex = currentBlockedUsers.findIndex(
        block => (block.user === blockedId || block.user?.id === blockedId || block.userId === blockedId)
      );

      if (blockIndex === -1) {
        const error = new Error('User is not blocked');
        await SecurityLogger.logUnblockEvent(blockerId, blockedId, req, false, error.message);
        throw error;
      }

      // Remove from blocked list
      const updatedBlockedUsers = [...currentBlockedUsers];
      updatedBlockedUsers.splice(blockIndex, 1);

      await prisma.user.update({
        where: { id: blockerId },
        data: { blockedUsers: updatedBlockedUsers }
      });

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
    if (!userId1 || !userId2) return false;
    
    const user = await prisma.user.findUnique({
      where: { id: userId1 },
      select: { blockedUsers: true }
    });

    if (!user || !user.blockedUsers || !Array.isArray(user.blockedUsers)) {
      return false;
    }

    return user.blockedUsers.some(
      block => (block.user === userId2 || block.user?.id === userId2 || block.userId === userId2)
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { blockedUsers: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const blockedList = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    // Slice the array of blocked user objects
    const paginatedBlocks = blockedList.slice(startIndex, endIndex);

    // Fetch user details for the blocked users
    // Extract IDs
    const blockedUserIds = paginatedBlocks.map(block => block.user || block.userId || block.user?.id);
    
    const blockedUsersDetails = await prisma.user.findMany({
      where: {
        id: { in: blockedUserIds }
      },
      select: {
        id: true,
        username: true,
        profilePicture: true
      }
    });

    // Create a map for easy lookup
    const userMap = blockedUsersDetails.reduce((acc, u) => {
      acc[u.id] = u;
      return acc;
    }, {});

    // Combine block info with user details
    const result = paginatedBlocks.map(block => {
      const id = block.user || block.userId || block.user?.id;
      const userDetail = userMap[id];
      
      if (!userDetail) return null; // Should not happen if data integrity is good

      return {
        id: userDetail.id,
        username: userDetail.username,
        profilePicture: userDetail.profilePicture,
        blockedAt: block.blockedAt,
        reason: block.reason
      };
    }).filter(Boolean);

    return {
      blockedUsers: result,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(blockedList.length / limit),
        totalCount: blockedList.length,
        hasNext: endIndex < blockedList.length,
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
