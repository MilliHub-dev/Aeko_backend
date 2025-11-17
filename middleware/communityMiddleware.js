import Community from '../models/Community.js';

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

    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Check if user is the community owner
    if (community.owner.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Only community owner can perform this action' 
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error('Community middleware error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
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

    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Check if user is the community owner or moderator
    const isOwner = community.owner.toString() === req.user.id;
    const isModerator = community.moderators.some(modId => modId.toString() === req.user.id);
    
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
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
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

    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Owner and moderators are always considered members
    const isOwner = community.owner.toString() === req.user.id;
    const isModerator = community.moderators.some(modId => modId.toString() === req.user.id);
    
    if (isOwner || isModerator) {
      req.community = community;
      return next();
    }

    // Check if user is an active member
    const member = community.members.find(
      m => m.user.toString() === req.user.id && m.status === 'active'
    );
    
    if (!member) {
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
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
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

    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Skip check if community is not private
    if (!community.settings?.isPrivate) {
      req.community = community;
      return next();
    }

    // Owner and moderators always have access
    const isOwner = community.owner.toString() === req.user.id;
    const isModerator = community.moderators.some(modId => modId.toString() === req.user.id);
    
    if (isOwner || isModerator) {
      req.community = community;
      return next();
    }

    // Check if user is an active member
    const member = community.members.find(
      m => m.user.toString() === req.user.id && m.status === 'active'
    );
    
    if (!member) {
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
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
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

    const community = await Community.findById(communityId);
    
    if (!community) {
      return res.status(404).json({ 
        success: false,
        message: 'Community not found' 
      });
    }

    // Skip check if community is not paid
    if (!community.settings?.payment?.isPaidCommunity) {
      return next();
    }

    // Check if user is the owner
    if (community.owner.toString() === req.user.id) {
      return next();
    }

    // Check if user is a moderator
    if (community.moderators.some(modId => modId.toString() === req.user.id)) {
      return next();
    }

    // Check if user has active membership
    const member = community.members.find(m => m.user.toString() === req.user.id);
    
    if (!member || member.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'You need to join this community to access its content',
        requiresPayment: true
      });
    }

    // Check if subscription exists
    if (!member.subscription) {
      return res.status(403).json({ 
        success: false,
        message: 'You need an active subscription to access this paid community',
        requiresPayment: true
      });
    }

    // Verify both isActive flag and endDate
    const currentDate = new Date();
    const hasEndDate = member.subscription.endDate;
    const isExpired = hasEndDate && currentDate > new Date(member.subscription.endDate);

    // Automatic expiration handling when endDate is past current date
    if (isExpired && member.subscription.isActive) {
      // Update member.subscription.isActive to false when expired
      member.subscription.isActive = false;
      // Save community after updating expired subscription
      await community.save();
      
      // Return appropriate error message with requiresRenewal flag
      return res.status(403).json({ 
        success: false,
        message: 'Your subscription has expired',
        requiresRenewal: true,
        subscriptionInfo: {
          endDate: member.subscription.endDate,
          type: member.subscription.type
        }
      });
    }

    // Check if subscription is marked as inactive
    if (!member.subscription.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Your subscription is not active',
        requiresRenewal: true,
        subscriptionInfo: {
          endDate: member.subscription.endDate,
          type: member.subscription.type
        }
      });
    }

    // Check if subscription has expired (even if still marked active)
    if (isExpired) {
      // Update subscription status to inactive
      member.subscription.isActive = false;
      await community.save();
      
      return res.status(403).json({ 
        success: false,
        message: 'Your subscription has expired',
        requiresRenewal: true,
        subscriptionInfo: {
          endDate: member.subscription.endDate,
          type: member.subscription.type
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
