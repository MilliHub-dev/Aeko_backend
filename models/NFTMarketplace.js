import mongoose from "mongoose";

const NFTMarketplaceSchema = new mongoose.Schema({
  // NFT Basics
  tokenId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  contractAddress: { 
    type: String, 
    required: true 
  },
  metadataUri: { 
    type: String, 
    required: true 
  },
  
  // Related Content
  originalPost: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Post", 
    required: true 
  },
  
  // Ownership
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  currentOwner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  creatorRoyalty: { 
    type: Number, 
    default: 10, // 10% royalty to original creator
    min: 0, 
    max: 50 
  },
  
  // Listing Details
  isListed: { 
    type: Boolean, 
    default: false 
  },
  listingType: { 
    type: String, 
    enum: ['fixed_price', 'auction', 'donation'], 
    default: 'fixed_price' 
  },
  price: { 
    type: Number, 
    default: 0 // In Aeko coins
  },
  
  // Auction specific (if listing type is auction)
  auction: {
    startingBid: { type: Number, default: 0 },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    auctionEndTime: { type: Date },
    reservePrice: { type: Number, default: 0 },
    bidHistory: [{
      bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      amount: { type: Number },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  
  // Donation specific (if listing type is donation)
  donations: {
    enabled: { type: Boolean, default: false },
    totalDonations: { type: Number, default: 0 },
    donationHistory: [{
      donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      amount: { type: Number },
      message: { type: String, maxlength: 200 },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  
  // Sale History
  saleHistory: [{
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    price: { type: Number },
    transactionId: { type: String },
    saleDate: { type: Date, default: Date.now },
    saleType: { type: String, enum: ['direct_sale', 'auction_win', 'transfer'] }
  }],
  
  // Metadata
  metadata: {
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    attributes: [{
      trait_type: { type: String },
      value: { type: mongoose.Schema.Types.Mixed }
    }],
    postStats: {
      originalViews: { type: Number, default: 0 },
      originalLikes: { type: Number, default: 0 },
      originalShares: { type: Number, default: 0 },
      mintDate: { type: Date, default: Date.now }
    }
  },
  
  // Platform Analytics
  analytics: {
    totalViews: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    uniqueViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    listingViews: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 }
  },
  
  // Status and Verification
  status: { 
    type: String, 
    enum: ['minting', 'active', 'sold', 'transferred', 'burned'], 
    default: 'minting' 
  },
  verified: { 
    type: Boolean, 
    default: false 
  },
  featured: { 
    type: Boolean, 
    default: false 
  },
  
  // Blockchain Data
  mintTransactionId: { 
    type: String 
  },
  mintBlockNumber: { 
    type: Number 
  },
  
  // Platform Features
  tags: [{ 
    type: String, 
    maxlength: 20 
  }],
  category: { 
    type: String, 
    enum: ['art', 'photography', 'video', 'meme', 'viral', 'trending', 'other'], 
    default: 'other' 
  },
  
  // Engagement
  favorites: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comment: { type: String, maxlength: 500 },
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance (tokenId already indexed via field definition)
NFTMarketplaceSchema.index({ creator: 1 });
NFTMarketplaceSchema.index({ currentOwner: 1 });
NFTMarketplaceSchema.index({ originalPost: 1 });
NFTMarketplaceSchema.index({ isListed: 1, status: 1 });
NFTMarketplaceSchema.index({ listingType: 1, price: 1 });
NFTMarketplaceSchema.index({ category: 1, verified: 1 });
NFTMarketplaceSchema.index({ featured: 1, createdAt: -1 });
NFTMarketplaceSchema.index({ 'auction.auctionEndTime': 1 });

// Virtual for current auction status
NFTMarketplaceSchema.virtual('auctionStatus').get(function() {
  if (this.listingType !== 'auction' || !this.auction.auctionEndTime) {
    return 'not_auction';
  }
  
  const now = new Date();
  if (now < this.auction.auctionEndTime) {
    return 'active';
  } else {
    return 'ended';
  }
});

// Virtual for time remaining in auction
NFTMarketplaceSchema.virtual('timeRemaining').get(function() {
  if (this.listingType !== 'auction' || !this.auction.auctionEndTime) {
    return null;
  }
  
  const now = new Date();
  const timeLeft = this.auction.auctionEndTime - now;
  return timeLeft > 0 ? timeLeft : 0;
});

// Method to place bid
NFTMarketplaceSchema.methods.placeBid = function(bidderId, amount) {
  if (this.listingType !== 'auction') {
    throw new Error('Not an auction item');
  }
  
  if (new Date() > this.auction.auctionEndTime) {
    throw new Error('Auction has ended');
  }
  
  if (amount <= this.auction.currentBid) {
    throw new Error('Bid must be higher than current bid');
  }
  
  // Add to bid history
  this.auction.bidHistory.push({
    bidder: bidderId,
    amount: amount
  });
  
  // Update current bid
  this.auction.currentBid = amount;
  this.auction.highestBidder = bidderId;
  
  return this.save();
};

// Method to add donation
NFTMarketplaceSchema.methods.addDonation = function(donorId, amount, message = '') {
  if (this.listingType !== 'donation' || !this.donations.enabled) {
    throw new Error('Donations not enabled for this NFT');
  }
  
  this.donations.donationHistory.push({
    donor: donorId,
    amount: amount,
    message: message
  });
  
  this.donations.totalDonations += amount;
  
  return this.save();
};

// Method to complete sale
NFTMarketplaceSchema.methods.completeSale = function(buyerId, salePrice, saleType, transactionId) {
  // Add to sale history
  this.saleHistory.push({
    seller: this.currentOwner,
    buyer: buyerId,
    price: salePrice,
    transactionId: transactionId,
    saleType: saleType
  });
  
  // Update ownership
  this.currentOwner = buyerId;
  this.isListed = false;
  this.status = 'sold';
  
  // Clear auction data if it was an auction
  if (this.listingType === 'auction') {
    this.auction.currentBid = 0;
    this.auction.highestBidder = null;
  }
  
  return this.save();
};

// Static method to get marketplace statistics
NFTMarketplaceSchema.statics.getMarketplaceStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalNFTs: { $sum: 1 },
        totalVolume: { 
          $sum: { 
            $reduce: {
              input: '$saleHistory',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.price'] }
            }
          }
        },
        listedNFTs: { 
          $sum: { $cond: ['$isListed', 1, 0] } 
        },
        averagePrice: { $avg: '$price' }
      }
    }
  ]);
};

// Static method to get trending NFTs
NFTMarketplaceSchema.statics.getTrending = function(limit = 10) {
  return this.find({ 
    status: 'active', 
    isListed: true 
  })
  .sort({ 
    'analytics.totalViews': -1, 
    'analytics.favoriteCount': -1, 
    createdAt: -1 
  })
  .limit(limit)
  .populate(['creator', 'currentOwner', 'originalPost']);
};

const NFTMarketplace = mongoose.model("NFTMarketplace", NFTMarketplaceSchema);
export default NFTMarketplace;