import mongoose from "mongoose";

const AekoTransactionSchema = new mongoose.Schema({
  // Transaction basics
  transactionId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  solanaSignature: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  
  // Transaction parties
  fromUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  toUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  fromWallet: { 
    type: String, 
    required: true 
  },
  toWallet: { 
    type: String, 
    required: true 
  },
  
  // Transaction details
  amount: { 
    type: Number, 
    required: true 
  },
  type: { 
    type: String, 
    enum: [
      'transfer', 
      'donation', 
      'giveaway', 
      'nft_purchase', 
      'nft_sale', 
      'stream_donation',
      'reward',
      'mint',
      'burn'
    ], 
    required: true 
  },
  
  // Status and confirmation
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  confirmations: { 
    type: Number, 
    default: 0 
  },
  blockNumber: { 
    type: Number 
  },
  
  // Related content
  relatedPost: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Post" 
  },
  relatedStream: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "LiveStream" 
  },
  relatedNFT: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "NFTMarketplace" 
  },
  
  // Additional data
  description: { 
    type: String, 
    maxlength: 500 
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed 
  },
  
  // Fees
  gasFee: { 
    type: Number, 
    default: 0 
  },
  platformFee: { 
    type: Number, 
    default: 0 
  },
  
  // Timestamps
  processedAt: { 
    type: Date 
  },
  confirmedAt: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

// Indexes for performance (transactionId and solanaSignature already indexed via field definition)
AekoTransactionSchema.index({ fromUser: 1, createdAt: -1 });
AekoTransactionSchema.index({ toUser: 1, createdAt: -1 });
AekoTransactionSchema.index({ type: 1, status: 1 });
AekoTransactionSchema.index({ relatedPost: 1 });
AekoTransactionSchema.index({ relatedStream: 1 });

// Static method to get user's transaction history
AekoTransactionSchema.statics.getUserTransactions = function(userId) {
  return this.find({
    $or: [
      { fromUser: userId },
      { toUser: userId }
    ]
  }).sort({ createdAt: -1 }).populate(['fromUser', 'toUser', 'relatedPost', 'relatedStream']);
};

// Static method to get platform revenue
AekoTransactionSchema.statics.getPlatformRevenue = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status: 'confirmed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalFees: { $sum: '$platformFee' },
        totalVolume: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);
};

const AekoTransaction = mongoose.model("AekoTransaction", AekoTransactionSchema);
export default AekoTransaction;