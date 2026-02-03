import { prisma } from "../config/db.js";

/**
 * Middleware to check if user is a community admin (owner only)
 */
export const isCommunityAdmin = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId || req.body.communityId;
    
    if (!communityId) {
      return res.status(400).json({ 
        success: false,
        message: 'Community ID is required' 
      });
    }

    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Check if user is the community owner
    if (community.ownerId !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Only community owner can perform this action' 
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error('Community middleware error:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * Middleware to check if user is a community owner or moderator
 */
export const isCommunityAdminOrModerator = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId || req.body.communityId;
    
    if (!communityId) {
      return res.status(400).json({ 
        success: false,
        message: 'Community ID is required' 
      });
    }

    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Check if user is the community owner
    const isOwner = community.ownerId === req.user.id;
    
    // Check if moderator
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: communityId,
          userId: req.user.id
        }
      }
    });
    
    const isModerator = member?.role === 'moderator';
    
    if (!isOwner && !isModerator) {
      return res.status(403).json({ 
        success: false,
        message: 'Only community owner or moderators can perform this action' 
      });
    }

    req.community = community;
    req.isOwner = isOwner;
    req.isModerator = isModerator;
    next();
  } catch (error) {
    console.error('Community admin/moderator check error:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * Middleware to check if user is a community member
 */
export const isCommunityMember = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId || req.body.communityId;
    
    if (!communityId) {
      return res.status(400).json({ 
        success: false,
        message: 'Community ID is required' 
      });
    }

    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Check membership
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: communityId,
          userId: req.user.id
        }
      }
    });

    const isOwner = community.ownerId === req.user.id;
    const isModerator = member?.role === 'moderator';
    const isActiveMember = member?.status === 'active';
    
    if (isOwner || isModerator) {
      req.community = community;
      return next();
    }

    if (!isActiveMember) {
      return res.status(403).json({ 
        success: false,
        message: 'You are not a member of this community or your membership is inactive' 
      });
    }

    req.community = community;
    req.member = member;
    next();
  } catch (error) {
    console.error('Community membership check error:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * Middleware to check if user can access private community
 */
export const checkPrivateCommunityAccess = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId || req.body.communityId;
    
    if (!communityId) {
      return res.status(400).json({ 
        success: false,
        message: 'Community ID is required' 
      });
    }

    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Skip check if community is not private
    // Note: check both top-level field and settings JSON
    const settings = community.settings || {};
    const isPrivate = community.isPrivate || settings.isPrivate;

    if (!isPrivate) {
      req.community = community;
      return next();
    }

    // Owner and moderators always have access
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: communityId,
          userId: req.user.id
        }
      }
    });

    const isOwner = community.ownerId === req.user.id;
    const isModerator = member?.role === 'moderator';
    
    if (isOwner || isModerator) {
      req.community = community;
      return next();
    }

    // Check if user is an active member
    if (!member || member.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'This is a private community. You need to be a member to access it.' 
      });
    }

    req.community = community;
    req.member = member;
    next();
  } catch (error) {
    console.error('Private community access check error:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * Middleware to check if community is paid and user has active subscription
 */
export const checkPaidCommunityAccess = async (req, res, next) => {
  try {
    const communityId = req.params.id || req.params.communityId || req.body.communityId;
    
    if (!communityId) {
      return res.status(400).json({ 
        success: false,
        message: 'Community ID is required' 
      });
    }

    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Skip check if community is not paid
    const settings = community.settings || {};
    if (!settings.payment?.isPaidCommunity) {
      return next();
    }

    // Check if user is the owner
    if (community.ownerId === req.user.id) {
      return next();
    }

    // Get member record
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: communityId,
          userId: req.user.id
        }
      }
    });

    // Check if user is a moderator
    if (member?.role === 'moderator') {
      return next();
    }

    // Check if user has active membership
    if (!member || member.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'You need to join this community to access its content',
        requiresPayment: true
      });
    }

    // Check if subscription exists
    const subscription = member.subscription;
    if (!subscription) {
      return res.status(403).json({ 
        success: false,
        message: 'You need an active subscription to access this paid community',
        requiresPayment: true
      });
    }

    // Verify both isActive flag and endDate
    const currentDate = new Date();
    const hasEndDate = subscription.endDate;
    const isExpired = hasEndDate && currentDate > new Date(subscription.endDate);

    // Automatic expiration handling when endDate is past current date
    if (isExpired && subscription.isActive) {
      // Update member.subscription.isActive to false when expired
      const updatedSubscription = { ...subscription, isActive: false };
      
      await prisma.communityMember.update({
        where: { id: member.id },
        data: { subscription: updatedSubscription }
      });
      
      // Return appropriate error message with requiresRenewal flag
      return res.status(403).json({ 
        success: false,
        message: 'Your subscription has expired',
        requiresRenewal: true,
        subscriptionInfo: {
          endDate: subscription.endDate,
          type: subscription.type
        }
      });
    }

    // Check if subscription is marked as inactive
    if (!subscription.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Your subscription is not active',
        requiresRenewal: true,
        subscriptionInfo: {
          endDate: subscription.endDate,
          type: subscription.type
        }
      });
    }

    // Subscription is valid - allow access
    next();
  } catch (error) {
    console.error('Paid community access check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};
