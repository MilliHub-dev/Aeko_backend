import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        originalOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Track original creator
        text: { type: String, default: "" },
        media: { type: String, default: "" }, // Image or video URL
        type: { type: String, enum: ["text", "image", "video"], required: true },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who liked the post
        reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who reposted
        originalPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null }, // For reposts
        comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }], // Comments on post
        
        // View tracking for NFT eligibility
        views: { type: Number, default: 0 },
        uniqueViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        
        // Transfer tracking
        transferHistory: [{
            fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            transferDate: { type: Date, default: Date.now },
            reason: { type: String, default: "" }
        }],
        
        // NFT related fields
        isEligibleForNFT: { type: Boolean, default: false },
        nftMinted: { type: Boolean, default: false },
        nftTokenId: { type: String, default: null },
        nftMetadataUri: { type: String, default: null },
        
        // Marketplace related
        isListedForSale: { type: Boolean, default: false },
        salePrice: { type: Number, default: 0 }, // In Aeko coins
        
        // Engagement metrics
        engagement: {
            totalShares: { type: Number, default: 0 },
            totalComments: { type: Number, default: 0 },
            totalLikes: { type: Number, default: 0 },
            totalBookmarks: { type: Number, default: 0 },
            engagementRate: { type: Number, default: 0 }
        },

        // Advertisement/promotion (optional)
        ad: {
            isPromoted: { type: Boolean, default: false },
            budget: { type: Number, default: 0 }, // In platform currency or USD
            target: { type: String, default: "" }, // e.g., audience keywords/segments
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null }
        },

        // Privacy settings
        privacy: {
            level: {
                type: String,
                enum: ['public', 'followers', 'select_users', 'only_me'],
                default: 'public'
            },
            selectedUsers: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }],
            updatedAt: {
                type: Date,
                default: Date.now
            },
            updateHistory: [{
                previousLevel: String,
                newLevel: String,
                updatedAt: Date,
                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            }]
        }
    },
    { timestamps: true }
);

// Add indexes for performance
PostSchema.index({ views: -1 });
PostSchema.index({ user: 1, views: -1 });
PostSchema.index({ isEligibleForNFT: 1, nftMinted: 1 });
PostSchema.index({ isListedForSale: 1 });
PostSchema.index({ 'ad.isPromoted': 1, 'ad.startDate': 1, 'ad.endDate': 1 });

// Privacy-related indexes for optimized queries
PostSchema.index({ 'privacy.level': 1 });
PostSchema.index({ 'privacy.selectedUsers': 1 });
PostSchema.index({ user: 1, 'privacy.level': 1 });

// Methods for view tracking
PostSchema.methods.incrementView = function(userId) {
    if (userId && !this.uniqueViewers.includes(userId)) {
        this.uniqueViewers.push(userId);
    }
    this.views += 1;
    
    // Check NFT eligibility (200k views + user must hold Aeko coins)
    if (this.views >= 200000 && !this.isEligibleForNFT) {
        this.isEligibleForNFT = true;
    }
    
    return this.save();
};

// Method for post transfer
PostSchema.methods.transferTo = function(newOwnerId, currentOwnerId, reason = "") {
    // Set original owner if not set
    if (!this.originalOwner) {
        this.originalOwner = this.user;
    }
    
    // Add to transfer history
    this.transferHistory.push({
        fromUser: currentOwnerId,
        toUser: newOwnerId,
        reason: reason
    });
    
    // Update current owner
    this.user = newOwnerId;
    
    return this.save();
};

// Method to update engagement metrics
PostSchema.methods.updateEngagement = function() {
    this.engagement.totalLikes = this.likes.length;
    this.engagement.totalComments = this.comments.length;
    this.engagement.totalShares = this.reposts.length;
    
    // Calculate engagement rate (likes + comments + shares) / views * 100
    if (this.views > 0) {
        const totalEngagement = this.engagement.totalLikes + this.engagement.totalComments + this.engagement.totalShares;
        this.engagement.engagementRate = (totalEngagement / this.views) * 100;
    }
    
    return this.save();
};

// Privacy validation and access control methods
PostSchema.methods.validatePrivacyLevel = function(privacyLevel, selectedUsers = []) {
    const validLevels = ['public', 'followers', 'select_users', 'only_me'];
    
    if (!validLevels.includes(privacyLevel)) {
        throw new Error('Invalid privacy level');
    }
    
    if (privacyLevel === 'select_users' && (!selectedUsers || selectedUsers.length === 0)) {
        throw new Error('Selected users must be provided for select_users privacy level');
    }
    
    return true;
};

PostSchema.methods.canUserAccess = async function(requestingUserId) {
    // Post creator can always access their own posts
    if (this.user.toString() === requestingUserId.toString()) {
        return true;
    }
    
    switch (this.privacy.level) {
        case 'public':
            return true;
            
        case 'only_me':
            return false;
            
        case 'followers':
            // Check if requesting user follows the post creator
            const User = mongoose.model('User');
            const postCreator = await User.findById(this.user);
            return postCreator && postCreator.followers.includes(requestingUserId);
            
        case 'select_users':
            return this.privacy.selectedUsers.includes(requestingUserId);
            
        default:
            return false;
    }
};

PostSchema.methods.updatePrivacy = function(newPrivacyLevel, selectedUsers = [], updatedBy) {
    // Validate the new privacy level
    this.validatePrivacyLevel(newPrivacyLevel, selectedUsers);
    
    // Store previous level for audit trail
    const previousLevel = this.privacy.level;
    
    // Update privacy settings
    this.privacy.level = newPrivacyLevel;
    this.privacy.selectedUsers = newPrivacyLevel === 'select_users' ? selectedUsers : [];
    this.privacy.updatedAt = new Date();
    
    // Add to update history for audit trail
    this.privacy.updateHistory.push({
        previousLevel: previousLevel,
        newLevel: newPrivacyLevel,
        updatedAt: new Date(),
        updatedBy: updatedBy
    });
    
    return this.save();
};

// Static method to find posts accessible by a specific user
PostSchema.statics.findAccessiblePosts = async function(requestingUserId) {
    const User = mongoose.model('User');
    const requestingUser = await User.findById(requestingUserId);
    
    if (!requestingUser) {
        throw new Error('User not found');
    }
    
    // Build query for accessible posts
    const query = {
        $or: [
            // Public posts
            { 'privacy.level': 'public' },
            // User's own posts
            { user: requestingUserId },
            // Posts where user is in selectedUsers
            { 
                'privacy.level': 'select_users',
                'privacy.selectedUsers': requestingUserId 
            }
        ]
    };
    
    // Add followers-only posts if user follows the creators
    const followedUsers = requestingUser.following || [];
    if (followedUsers.length > 0) {
        query.$or.push({
            'privacy.level': 'followers',
            user: { $in: followedUsers }
        });
    }
    
    return this.find(query);
};

// Static method to find NFT eligible posts
PostSchema.statics.findNFTEligible = function() {
    return this.find({
        isEligibleForNFT: true,
        nftMinted: false,
        views: { $gte: 200000 }
    }).populate('user', 'username walletAddress aekoBalance');
};

// Virtual for getting post ownership chain
PostSchema.virtual('ownershipChain').get(function() {
    return {
        originalOwner: this.originalOwner,
        currentOwner: this.user,
        transferCount: this.transferHistory.length,
        transferHistory: this.transferHistory
    };
});

const Post = mongoose.model("Post", PostSchema);
export default Post; // ✅ Correct ES Module export
