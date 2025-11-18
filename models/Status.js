import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text', 'image', 'video', 'shared_post'], required: true },
  content: { type: String, required: true }, // URL for image/video or text
  reactions: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      emoji: { type: String }
    }
  ],
  
  // Shared post functionality
  sharedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  originalContent: {
    text: { type: String, default: '' },
    media: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: { type: Date }
  },
  shareMetadata: {
    sharedAt: {
      type: Date,
      default: Date.now
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: '24h' } } // Auto-delete after 24 hours
}, {
  timestamps: true // This adds createdAt and updatedAt fields
});

// Method to create a shared post status
statusSchema.statics.createSharedPostStatus = async function(postId, sharingUserId, additionalContent = '') {
  const Post = mongoose.model('Post');
  
  // Find the original post
  const originalPost = await Post.findById(postId).populate('user', 'username');
  if (!originalPost) {
    throw new Error('Original post not found');
  }
  
  // Check if the sharing user can access the original post
  const canAccess = await originalPost.canUserAccess(sharingUserId);
  if (!canAccess) {
    throw new Error('User does not have permission to share this post');
  }
  
  // Create the shared status
  const sharedStatus = new this({
    userId: sharingUserId,
    type: 'shared_post',
    content: additionalContent || `Shared a post by ${originalPost.user.username}`,
    sharedPost: postId,
    originalContent: {
      text: originalPost.text,
      media: originalPost.media,
      type: originalPost.type,
      creator: originalPost.user._id,
      createdAt: originalPost.createdAt
    },
    shareMetadata: {
      sharedAt: new Date(),
      sharedBy: sharingUserId
    }
  });
  
  return await sharedStatus.save();
};

// Method to preserve original post content
statusSchema.methods.preserveOriginalContent = function(originalPost) {
  this.originalContent = {
    text: originalPost.text || '',
    media: originalPost.media || '',
    type: originalPost.type,
    creator: originalPost.user,
    createdAt: originalPost.createdAt
  };
  
  return this;
};

// Method to check if status is a shared post
statusSchema.methods.isSharedPost = function() {
  return this.type === 'shared_post' && this.sharedPost !== null;
};

// Method to get formatted shared post data
statusSchema.methods.getSharedPostData = async function() {
  if (!this.isSharedPost()) {
    return null;
  }
  
  await this.populate([
    { path: 'originalContent.creator', select: 'username profilePicture' },
    { path: 'shareMetadata.sharedBy', select: 'username profilePicture' }
  ]);
  
  return {
    originalPost: {
      content: this.originalContent.text,
      media: this.originalContent.media,
      type: this.originalContent.type,
      creator: this.originalContent.creator,
      createdAt: this.originalContent.createdAt
    },
    shareInfo: {
      sharedAt: this.shareMetadata.sharedAt,
      sharedBy: this.shareMetadata.sharedBy,
      additionalContent: this.content
    }
  };
};

// Static method to find shared post statuses by original post
statusSchema.statics.findBySharedPost = function(postId) {
  return this.find({ 
    sharedPost: postId,
    type: 'shared_post'
  }).populate([
    { path: 'userId', select: 'username profilePicture' },
    { path: 'originalContent.creator', select: 'username profilePicture' }
  ]);
};

export default mongoose.model('Status', statusSchema);
