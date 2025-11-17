import Community from "../models/Community.js";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import { validationResult } from "express-validator";

// @desc    Create a new community
// @route   POST /api/communities
// @access  Private (Golden tick users only)
export const createCommunity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, isPrivate, tags } = req.body;
    const userId = req.user.id;

    // Check if user has golden tick
    const user = await User.findById(userId);
    if (!user.goldenTick) {
      return res.status(403).json({ 
        success: false,
        message: 'Only users with golden tick can create communities' 
      });
    }

    // Create community
    const community = new Community({
      name,
      description,
      owner: userId,
      isPrivate: isPrivate || false,
      tags: tags || []
    });

    // Create a chat for the community
    const chat = new Chat({
      isGroupChat: true,
      groupAdmin: userId,
      chatName: name,
      isCommunityChat: true,
      community: community._id
    });

    await chat.save();
    
    // Add chat reference to community
    community.chat = chat._id;
    await community.save();
    
    // Add creator as first member and owner (this synchronizes both models)
    await community.addMember(userId, 'owner');
    
    // Update user's ownedCommunities
    user.ownedCommunities.push(community._id);
    await user.save();

    res.status(201).json({
      success: true,
      data: community
    });
  } catch (error) {
    console.error('Error creating community:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A community with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
export const getCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      isActive: true,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [search] } }
      ]
    };

    const [communities, total] = await Promise.all([
      Community.find(query)
        .populate('owner', 'name username profilePicture')
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Community.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: communities,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get community by ID
// @route   GET /api/communities/:id
// @access  Public
export const getCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate('owner', 'name username profilePicture')
      .populate('moderators', 'name username profilePicture')
      .populate('members.user', 'name username profilePicture');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is member (for private communities)
    const isMember = req.user ? 
      community.members.some(member => member.user._id.toString() === req.user.id) :
      false;

    if (community.isPrivate && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'This is a private community. You need to be a member to view it.'
      });
    }

    res.status(200).json({
      success: true,
      data: community
    });
  } catch (error) {
    console.error('Error fetching community:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Join a community
// @route   POST /api/communities/:id/join
// @access  Private
export const joinCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    const userId = req.user.id;

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if already a member
    const existingMember = community.members.find(member => 
      member.user.toString() === userId
    );

    if (existingMember) {
      if (existingMember.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this community'
        });
      }
      if (existingMember.status === 'banned') {
        return res.status(403).json({
          success: false,
          message: 'You are banned from this community'
        });
      }
    }

    // Check if community is paid - require payment before joining
    if (community.settings?.payment?.isPaidCommunity) {
      return res.status(402).json({
        success: false,
        message: 'This is a paid community. Please complete payment first.',
        requiresPayment: true,
        paymentInfo: {
          price: community.settings.payment.price,
          currency: community.settings.payment.currency,
          subscriptionType: community.settings.payment.subscriptionType,
          availableMethods: community.settings.payment.paymentMethods
        }
      });
    }

    // For private communities, add to pending requests
    if (community.settings?.isPrivate) {
      // In a real app, you would add to pending requests
      return res.status(200).json({
        success: true,
        message: 'Join request sent. Waiting for approval.',
        requiresApproval: true
      });
    }

    // For free public communities, add directly
    const status = community.settings?.requireApproval ? 'pending' : 'active';
    
    // Use addMember method which synchronizes both Community and User models
    await community.addMember(userId, 'member');
    
    // Update member status if approval is required
    if (status === 'pending') {
      const member = community.members.find(m => m.user.toString() === userId);
      member.status = status;
      await community.save();
    }

    // Add user to community chat if active
    if (status === 'active' && community.chat) {
      await Chat.findByIdAndUpdate(community.chat, {
        $addToSet: { users: userId }
      });
    }

    res.status(200).json({
      success: true,
      message: status === 'pending' ? 
        'Join request sent. Waiting for approval.' : 
        'Successfully joined the community',
      data: { status }
    });
  } catch (error) {
    console.error('Error joining community:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Leave a community
// @route   POST /api/communities/:id/leave
// @access  Private
export const leaveCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    const userId = req.user.id;

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if owner (owners can't leave, must delete or transfer ownership)
    if (community.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Community owner cannot leave. Transfer ownership or delete the community.'
      });
    }

    // Check if member
    const isMember = community.members.some(member => 
      member.user.toString() === userId
    );

    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this community'
      });
    }

    // Remove from community (this also synchronizes with User.communities)
    await community.removeMember(userId);

    // Remove from ownedCommunities if applicable (shouldn't happen since owners can't leave)
    await User.findByIdAndUpdate(userId, {
      $pull: { 
        ownedCommunities: community._id
      }
    });

    // Remove from community chat
    if (community.chat) {
      await Chat.findByIdAndUpdate(community.chat, {
        $pull: { users: userId }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Successfully left the community'
    });
  } catch (error) {
    console.error('Error leaving community:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update community
// @route   PUT /api/communities/:id
// @access  Private (Community owner/moderators)
export const updateCommunity = async (req, res) => {
  try {
    const { name, description, isPrivate, tags, settings } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner or moderator
    const isOwner = community.owner.toString() === req.user.id;
    const isModerator = community.moderators.some(
      modId => modId.toString() === req.user.id
    );

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community'
      });
    }

    // Update fields
    if (name) community.name = name;
    if (description) community.description = description;
    if (typeof isPrivate !== 'undefined') community.isPrivate = isPrivate;
    if (tags) community.tags = tags;
    if (settings) community.settings = { ...community.settings, ...settings };

    await community.save();

    res.status(200).json({
      success: true,
      data: community
    });
  } catch (error) {
    console.error('Error updating community:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete community
// @route   DELETE /api/communities/:id
// @access  Private (Community owner only)
export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner
    if (community.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this community'
      });
    }

    // Soft delete
    community.isActive = false;
    await community.save();

    // Remove all members from both Community and User models atomically
    const memberIds = community.members.map(m => m.user);
    for (const memberId of memberIds) {
      await community.removeMember(memberId);
    }

    // Remove from owner's ownedCommunities
    await User.findByIdAndUpdate(community.owner, {
      $pull: { 
        ownedCommunities: community._id
      }
    });

    // Note: In a real app, you might want to handle the chat deletion/archiving here

    res.status(200).json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting community:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
