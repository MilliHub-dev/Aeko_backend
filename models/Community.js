import mongoose from "mongoose";

const CommunitySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  description: {
    type: String,
    maxlength: 500,
    default: ""
  },
  // Profile Information
  profile: {
    avatar: {
      type: String,
      default: ""
    },
    coverPhoto: {
      type: String,
      default: ""
    },
    website: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      default: ""
    }
  },
  // Community Settings
  settings: {
    isPrivate: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    canPost: {
      type: Boolean,
      default: true
    },
    canComment: {
      type: Boolean,
      default: true
    },
    // Payment Settings
    payment: {
      isPaidCommunity: {
        type: Boolean,
        default: false
      },
      price: {
        type: Number,
        default: 0,
        min: 0
      },
      currency: {
        type: String,
        default: "USD"
      },
      subscriptionType: {
        type: String,
        enum: ["one_time", "monthly", "yearly"],
        default: "one_time"
      },
      paymentMethods: [{
        type: String,
        enum: ["paystack", "stripe", "aeko_wallet"],
        default: ["aeko_wallet"]
      }],
      walletAddress: String, // For Aeko wallet payments
      stripeAccountId: String, // For Stripe Connect
      paystackSubaccount: String, // For Paystack subaccounts
      availableForWithdrawal: {
        type: Number,
        default: 0
      },
      totalEarnings: {
        type: Number,
        default: 0
      },
      pendingWithdrawals: {
        type: Number,
        default: 0
      },
      withdrawalHistory: [{
        amount: Number,
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed'],
          default: 'pending'
        },
        method: String,
        reference: String,
        processedAt: Date,
        metadata: Object
      }]
    },
    // Post Settings
    postSettings: {
      allowImages: {
        type: Boolean,
        default: true
      },
      allowVideos: {
        type: Boolean,
        default: true
      },
      allowLinks: {
        type: Boolean,
        default: true
      },
      requireApproval: {
        type: Boolean,
        default: false
      }
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    role: {
      type: String,
      enum: ["member", "moderator"],
      default: "member"
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["pending", "active", "banned"],
      default: "pending"
    },
    subscription: {
      type: {
        type: String,
        enum: ["trial", "one_time", "monthly", "yearly"],
        default: "one_time"
      },
      startDate: Date,
      endDate: Date,
      isActive: {
        type: Boolean,
        default: false
      },
      paymentMethod: String,
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction"
      }
    }
  }],
  avatar: {
    type: String,
    default: ""
  },
  banner: {
    type: String,
    default: ""
  },
  rules: [{
    title: String,
    description: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat"
  },
  memberCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
CommunitySchema.index({ name: 'text', description: 'text' });
CommunitySchema.index({ owner: 1 });
CommunitySchema.index({ 'members.user': 1 });
CommunitySchema.index({ 'settings.payment.isPaidCommunity': 1 });

// Virtual for member count
CommunitySchema.virtual('membersCount').get(function() {
  return this.members.length;
});

// Add member to community and synchronize with User model
CommunitySchema.methods.addMember = async function(userId, role = 'member', subscriptionData = null) {
  const User = mongoose.model('User');
  const isMember = this.members.some(member => member.user.toString() === userId.toString());
  
  if (!isMember) {
    // Add to Community.members
    const memberData = {
      user: userId,
      role
    };
    
    // Add subscription data if provided
    if (subscriptionData) {
      memberData.subscription = subscriptionData;
      memberData.status = 'active';
    }
    
    this.members.push(memberData);
    this.memberCount += 1;
    await this.save();
    
    // Synchronize with User.communities
    const user = await User.findById(userId);
    if (user) {
      const communityIndex = user.communities.findIndex(
        c => c.community.toString() === this._id.toString()
      );
      
      if (communityIndex >= 0) {
        // Update existing entry
        user.communities[communityIndex].role = role;
        user.communities[communityIndex].joinedAt = new Date();
        if (subscriptionData) {
          user.communities[communityIndex].subscription = subscriptionData;
        }
      } else {
        // Add new entry
        const userCommunityData = {
          community: this._id,
          role,
          joinedAt: new Date(),
          notifications: true
        };
        
        if (subscriptionData) {
          userCommunityData.subscription = subscriptionData;
        }
        
        user.communities.push(userCommunityData);
      }
      
      await user.save();
    }
  }
  return this;
};

// Remove member from community and synchronize with User model
CommunitySchema.methods.removeMember = async function(userId) {
  const User = mongoose.model('User');
  const initialLength = this.members.length;
  this.members = this.members.filter(member => member.user.toString() !== userId.toString());
  
  if (this.members.length < initialLength) {
    this.memberCount = Math.max(0, this.memberCount - 1);
    await this.save();
    
    // Synchronize with User.communities
    const user = await User.findById(userId);
    if (user) {
      user.communities = user.communities.filter(
        c => c.community.toString() !== this._id.toString()
      );
      await user.save();
    }
  }
  return this;
};

// Update member role and synchronize with User model
CommunitySchema.methods.updateMemberRole = async function(userId, newRole) {
  const User = mongoose.model('User');
  
  // Update in Community.members
  const memberIndex = this.members.findIndex(
    member => member.user.toString() === userId.toString()
  );
  
  if (memberIndex < 0) {
    throw new Error('Member not found in community');
  }
  
  this.members[memberIndex].role = newRole;
  await this.save();
  
  // Synchronize with User.communities
  const user = await User.findById(userId);
  if (user) {
    const communityIndex = user.communities.findIndex(
      c => c.community.toString() === this._id.toString()
    );
    
    if (communityIndex >= 0) {
      user.communities[communityIndex].role = newRole;
      await user.save();
    }
  }
  
  return this;
};

// Check if user is member
CommunitySchema.methods.isMember = function(userId) {
  return this.members.some(member => member.user.toString() === userId.toString());
};

// Check if user is moderator or owner
CommunitySchema.methods.isModerator = function(userId) {
  if (this.owner.toString() === userId.toString()) return true;
  return this.moderators.some(modId => modId.toString() === userId.toString());
};

const Community = mongoose.model("Community", CommunitySchema);
export default Community;
