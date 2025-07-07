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
            engagementRate: { type: Number, default: 0 }
        }
    },
    { timestamps: true }
);

// Add indexes for performance
PostSchema.index({ views: -1 });
PostSchema.index({ user: 1, views: -1 });
PostSchema.index({ isEligibleForNFT: 1, nftMinted: 1 });
PostSchema.index({ isListedForSale: 1 });

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
