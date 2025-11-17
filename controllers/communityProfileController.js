import Community from "../models/Community.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import { validationResult } from "express-validator";
import cloudinary from "../services/cloudinaryService.js";

// @desc    Update community profile
// @route   PUT /api/communities/:id/profile
// @access  Private (Community owner/moderators)
export const updateCommunityProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, website, location } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner or moderator
    const isAuthorized = community.owner.toString() === req.user.id || 
                        community.moderators.includes(req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community profile'
      });
    }

    // Update profile fields
    if (name) community.name = name;
    if (description) community.description = description;
    if (website !== undefined) community.profile.website = website;
    if (location !== undefined) community.profile.location = location;

    await community.save();

    res.status(200).json({
      success: true,
      data: community
    });
  } catch (error) {
    console.error('Error updating community profile:', error);
    
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

// @desc    Upload community avatar/cover photo
// @route   POST /api/communities/:id/upload-photo
// @access  Private (Community owner/moderators)
export const uploadCommunityPhoto = async (req, res) => {
  try {
    const { type } = req.query; // 'avatar' or 'cover'
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner or moderator
    const isAuthorized = community.owner.toString() === req.user.id || 
                        community.moderators.includes(req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    // Validate Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary configuration missing');
      return res.status(503).json({
        success: false,
        message: 'Image upload service is not configured. Please contact support.'
      });
    }

    // Validate file type (only images allowed)
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedImageTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
      });
    }

    // Validate file size (max 5MB for images)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }

    // Validate type parameter
    if (type && type !== 'avatar' && type !== 'cover') {
      return res.status(400).json({
        success: false,
        message: 'Invalid photo type. Must be "avatar" or "cover".'
      });
    }

    let uploadResult;
    
    try {
      // Upload to Cloudinary using the file path (if available) or buffer
      if (req.file.path) {
        // File was saved to disk (using disk storage)
        uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: `aeko/communities/${community._id}`,
          resource_type: 'image',
          transformation: [
            {
              quality: 'auto',
              fetch_format: 'auto'
            }
          ]
        });
      } else if (req.file.buffer) {
        // File is in memory (using memory storage)
        // Convert buffer to base64 data URI
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: `aeko/communities/${community._id}`,
          resource_type: 'image',
          transformation: [
            {
              quality: 'auto',
              fetch_format: 'auto'
            }
          ]
        });
      } else {
        throw new Error('No file data available');
      }
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(503).json({
        success: false,
        message: 'Failed to upload image. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
      });
    }

    // Only update community profile if upload was successful
    if (!uploadResult || !uploadResult.secure_url) {
      return res.status(500).json({
        success: false,
        message: 'Upload completed but no URL was returned. Please try again.'
      });
    }

    // Update community profile with the photo URL
    if (type === 'cover') {
      community.profile.coverPhoto = uploadResult.secure_url;
    } else {
      community.profile.avatar = uploadResult.secure_url;
    }

    await community.save();

    res.status(200).json({
      success: true,
      data: community.profile,
      message: `Community ${type || 'avatar'} updated successfully`
    });
  } catch (error) {
    console.error('Error uploading community photo:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid community ID format'
      });
    }
    
    // Handle Cloudinary-specific errors
    if (error.message && (error.message.includes('Cloudinary') || error.message.includes('cloudinary'))) {
      return res.status(503).json({
        success: false,
        message: 'Image upload service temporarily unavailable. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update community settings
// @route   PUT /api/communities/:id/settings
// @access  Private (Community owner/moderators)
export const updateCommunitySettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Only owner can update settings
    if (community.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the community owner can update settings'
      });
    }

    // Update settings
    if (settings) {
      // Merge settings instead of replacing to preserve nested objects
      community.settings = {
        ...community.settings.toObject(),
        ...settings,
        // Ensure payment settings are properly merged
        payment: settings.payment ? {
          ...community.settings.payment.toObject(),
          ...settings.payment
        } : community.settings.payment,
        // Ensure post settings are properly merged
        postSettings: settings.postSettings ? {
          ...community.settings.postSettings.toObject(),
          ...settings.postSettings
        } : community.settings.postSettings
      };
    }

    await community.save();

    res.status(200).json({
      success: true,
      data: community.settings
    });
  } catch (error) {
    console.error('Error updating community settings:', error);
    
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

// @desc    Follow a community
// @route   POST /api/communities/:id/follow
// @access  Private
export const followCommunity = async (req, res) => {
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
    const isMember = await User.exists({
      _id: userId,
      'communityMemberships.community': community._id
    });

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this community. Use join endpoint instead.'
      });
    }

    // Check if already following
    const isFollowing = await User.exists({
      _id: userId,
      'followingCommunities.community': community._id
    });

    if (isFollowing) {
      return res.status(400).json({
        success: false,
        message: 'You are already following this community'
      });
    }

    // Add to user's following list
    await User.findByIdAndUpdate(userId, {
      $push: {
        followingCommunities: {
          community: community._id
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully followed the community'
    });
  } catch (error) {
    console.error('Error following community:', error);
    
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

// @desc    Unfollow a community
// @route   POST /api/communities/:id/unfollow
// @access  Private
export const unfollowCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    const userId = req.user.id;

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Remove from user's following list
    await User.findByIdAndUpdate(userId, {
      $pull: {
        followingCommunities: {
          community: community._id
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully unfollowed the community'
    });
  } catch (error) {
    console.error('Error unfollowing community:', error);
    
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

// @desc    Create a post in community
// @route   POST /api/communities/:id/posts
// @access  Private
export const createCommunityPost = async (req, res) => {
  try {
    const { content, media } = req.body;
    const community = await Community.findById(req.params.id);
    const userId = req.user.id;

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is a member or following (if community allows posts from followers)
    const isMember = await User.exists({
      _id: userId,
      'communityMemberships.community': community._id
    });

    const isFollowing = await User.exists({
      _id: userId,
      'followingCommunities.community': community._id
    });

    if (!isMember && (!isFollowing || community.settings.postSettings.requireMembershipToPost)) {
      return res.status(403).json({
        success: false,
        message: 'You need to be a member to post in this community'
      });
    }

    // Check if community allows posting
    if (!community.settings.canPost) {
      return res.status(403).json({
        success: false,
        message: 'This community has disabled posting'
      });
    }

    // Create post
    const post = new Post({
      content,
      author: userId,
      community: community._id,
      media: media || [],
      isCommunityPost: true,
      status: community.settings.postSettings.requireApproval ? 'pending' : 'active'
    });

    await post.save();

    // Add post to community's posts
    await Community.findByIdAndUpdate(community._id, {
      $push: { posts: post._id }
    });

    // Add post to user's posts
    await User.findByIdAndUpdate(userId, {
      $push: { posts: post._id }
    });

    // Notify community moderators if approval is required
    if (community.settings.postSettings.requireApproval) {
      // In a real app, you would send a notification here
      console.log(`Post ${post._id} is pending approval in community ${community._id}`);
    }

    res.status(201).json({
      success: true,
      data: post,
      message: community.settings.postSettings.requireApproval ? 
        'Post submitted for approval' : 'Post created successfully'
    });
  } catch (error) {
    console.error('Error creating community post:', error);
    
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

// @desc    Get community posts
// @route   GET /api/communities/:id/posts
// @access  Public
export const getCommunityPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const communityId = req.params.id;
    const userId = req.user?.id;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is a member (for private communities)
    if (community.settings.isPrivate && userId) {
      const isMember = await User.exists({
        _id: userId,
        $or: [
          { 'communityMemberships.community': communityId },
          { 'followingCommunities.community': communityId }
        ]
      });

      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'This is a private community. You need to be a member to view posts.'
        });
      }
    }

    // Build query
    const query = {
      community: communityId,
      status: 'active' // Only show approved posts
    };

    // If user is not a moderator/owner, only show their own pending posts
    if (userId) {
      const isModerator = await User.exists({
        _id: userId,
        $or: [
          { 'communityMemberships.community': communityId, 'communityMemberships.role': { $in: ['moderator', 'owner'] } },
          { _id: community.owner }
        ]
      });

      if (!isModerator) {
        query.$or = [
          { status: 'active' },
          { author: userId, status: 'pending' }
        ];
      }
    } else {
      query.status = 'active'; // Non-logged in users only see active posts
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'name username profilePicture')
        .populate('community', 'name profile.avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Post.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching community posts:', error);
    
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
