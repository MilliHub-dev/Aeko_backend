import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import crypto from 'crypto';


const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // OAuth fields
  oauthProvider: { type: String, enum: [null, 'google'], default: null },
  oauthId: { type: String, default: null },
  avatar: { type: String, default: "" },
  lastLoginAt: { type: Date, default: null },
  profilePicture: { type: String, default: "" },
  bio: { type: String, default: "" },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  walletAddress: String, // Ethereum wallet (legacy)
  solanaWalletAddress: String, // Solana wallet for Aeko coin
  aekoBalance: { type: Number, default: 0 }, // Aeko coin balance
  blueTick: { type: Boolean, default: false }, // Free verification
  goldenTick: { type: Boolean, default: false }, // Paid verification
  subscriptionStatus: {
    type: String,
    enum: ["inactive", "active"],
    default: "inactive",
  },
  subscriptionExpiry: { type: Date, default: null },
  banned: { type: Boolean, default: false }, // User ban status
  isAdmin: { type: Boolean, default: false }, // Admin privileges
  botEnabled: { type: Boolean, default: false }, // Bot ON/OFF
  botPersonality: { type: String, default: "friendly" }, // Personality type
  botResponses: [{ type: String }], // User's past responses for training
  botPreferences: {
    preferredSentiment: { type: String, enum: ["positive", "negative", "neutral"], default: "neutral" },
    topics: [String],
    communicationStyle: { type: String, default: "casual" },
    responseLength: { type: String, enum: ["short", "medium", "long"], default: "medium" }
  },
  botAnalytics: {
    totalInteractions: { type: Number, default: 0 },
    lastInteraction: { type: Date },
    averageResponseTime: { type: Number, default: 0 },
    satisfactionRating: { type: Number, default: 5, min: 1, max: 10 }
  },
  // Email Verification System
  emailVerification: {
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null },
    codeExpiresAt: { type: Date, default: null },
    codeAttempts: { type: Number, default: 0 },
    lastCodeSent: { type: Date, default: null }
  },
  // Profile Completion for Blue Tick
  profileCompletion: {
    hasProfilePicture: { type: Boolean, default: false },
    hasBio: { type: Boolean, default: false },
    hasFollowers: { type: Boolean, default: false }, // At least 1 follower
    hasWalletConnected: { type: Boolean, default: false },
    hasVerifiedEmail: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completionPercentage: { type: Number, default: 0 }
  },
  // User interests
  interests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interest'
  }],
  // Bookmarks
  bookmarks: [{
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    savedAt: { type: Date, default: Date.now }
  }],
  // Community features
  communities: [{
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community'
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'owner'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    notifications: {
      type: Boolean,
      default: true
    },
    // Track subscription for paid communities
    subscription: {
      type: {
        type: String,
        enum: ['trial', 'one_time', 'monthly', 'yearly']
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
        ref: 'Transaction'
      }
    }
  }],
  ownedCommunities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
  }],
  // Communities the user is following (without joining chat)
  followingCommunities: [{
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community'
    },
    followedAt: {
      type: Date,
      default: Date.now
    },
    notifications: {
      type: Boolean,
      default: true
    }
  }],
  // Communities the user is a member of (including chat)
  communityMemberships: [{
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community'
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'owner'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    notifications: {
      type: Boolean,
      default: true
    },
    // Track payment status for paid communities
    paymentStatus: {
      isPaid: {
        type: Boolean,
        default: false
      },
      amountPaid: Number,
      currency: String,
      paymentDate: Date,
      expiresAt: Date,
      subscriptionId: String,
      paymentMethod: String
    }
  }],
  // Onboarding status
  onboarding: {
    interestsSelected: { type: Boolean, default: false },
    completed: { type: Boolean, default: false }
  },
  
  // Security Features - Blocking System
  blockedUsers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blockedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "" }
  }],
  
  // Privacy Settings
  privacy: {
    isPrivate: { type: Boolean, default: false },
    allowFollowRequests: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    allowDirectMessages: { 
      type: String, 
      enum: ["everyone", "followers", "none"], 
      default: "everyone" 
    }
  },
  
  // Follow Requests for Private Accounts
  followRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected"], 
      default: "pending" 
    }
  }],
  
  // Two-Factor Authentication
  twoFactorAuth: {
    isEnabled: { type: Boolean, default: false },
    secret: { type: String, default: null }, // Encrypted TOTP secret
    backupCodes: [{ 
      code: { type: String, required: true }, // Hashed backup code
      used: { type: Boolean, default: false },
      usedAt: { type: Date, default: null }
    }],
    enabledAt: { type: Date, default: null },
    lastUsed: { type: Date, default: null }
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Update profile completion before saving
UserSchema.pre('save', function (next) {
  // Update profile completion status
  this.profileCompletion.hasProfilePicture = !!this.profilePicture;
  this.profileCompletion.hasBio = !!this.bio && this.bio.length > 10;
  this.profileCompletion.hasFollowers = this.followers.length > 0;
  this.profileCompletion.hasWalletConnected = !!this.solanaWalletAddress;
  this.profileCompletion.hasVerifiedEmail = this.emailVerification.isVerified;
  
  // Calculate completion percentage (wallet connection not required for blue tick)
  const requirements = [
    this.profileCompletion.hasProfilePicture,
    this.profileCompletion.hasBio,
    this.profileCompletion.hasFollowers,
    this.profileCompletion.hasVerifiedEmail
  ];
  
  const completedCount = requirements.filter(req => req).length;
  this.profileCompletion.completionPercentage = Math.round((completedCount / requirements.length) * 100);
  
  // Award blue tick if all requirements are met (wallet not required)
  if (completedCount === requirements.length && !this.blueTick) {
    this.blueTick = true;
    this.profileCompletion.completedAt = new Date();
  }
  
  next();
});

// Compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// 2FA Secret Encryption/Decryption Methods
UserSchema.methods.encrypt2FASecret = function(secret) {
  if (!secret) return null;
  
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'fallback-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex')
  };
};

UserSchema.methods.decrypt2FASecret = function(encryptedData) {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'fallback-key', 'salt', 32);
    
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting 2FA secret:', error);
    return null;
  }
};

// Set encrypted 2FA secret
UserSchema.methods.set2FASecret = function(secret) {
  const encryptedData = this.encrypt2FASecret(secret);
  this.twoFactorAuth.secret = JSON.stringify(encryptedData);
};

// Get decrypted 2FA secret
UserSchema.methods.get2FASecret = function() {
  if (!this.twoFactorAuth.secret) return null;
  
  try {
    const encryptedData = JSON.parse(this.twoFactorAuth.secret);
    return this.decrypt2FASecret(encryptedData);
  } catch (error) {
    console.error('Error parsing encrypted 2FA secret:', error);
    return null;
  }
};

// Generate 4-digit verification code
UserSchema.methods.generateVerificationCode = function() {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  this.emailVerification.verificationCode = code;
  this.emailVerification.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.emailVerification.lastCodeSent = new Date();
  return code;
};

// Verify email code
UserSchema.methods.verifyEmailCode = function(inputCode) {
  if (!this.emailVerification.verificationCode) {
    return { success: false, message: 'No verification code found' };
  }
  
  if (this.emailVerification.codeExpiresAt < new Date()) {
    return { success: false, message: 'Verification code has expired' };
  }
  
  if (this.emailVerification.codeAttempts >= 3) {
    return { success: false, message: 'Too many failed attempts. Please request a new code' };
  }
  
  if (this.emailVerification.verificationCode === inputCode) {
    this.emailVerification.isVerified = true;
    this.emailVerification.verificationCode = null;
    this.emailVerification.codeExpiresAt = null;
    this.emailVerification.codeAttempts = 0;
    return { success: true, message: 'Email verified successfully' };
  } else {
    this.emailVerification.codeAttempts += 1;
    return { success: false, message: 'Invalid verification code' };
  }
};

// Check if user can request new code (rate limiting)
UserSchema.methods.canRequestNewCode = function() {
  if (!this.emailVerification.lastCodeSent) return true;
  const timeSinceLastCode = Date.now() - this.emailVerification.lastCodeSent.getTime();
  return timeSinceLastCode > 60000; // 1 minute cooldown
};

// Indexes for efficient blocking queries
UserSchema.index({ "blockedUsers.user": 1 });
UserSchema.index({ "blockedUsers.blockedAt": 1 });

// Indexes for privacy and follow request queries
UserSchema.index({ "privacy.isPrivate": 1 });
UserSchema.index({ "followRequests.user": 1 });
UserSchema.index({ "followRequests.status": 1 });
UserSchema.index({ "followRequests.requestedAt": 1 });

// Indexes for 2FA queries
UserSchema.index({ "twoFactorAuth.isEnabled": 1 });
UserSchema.index({ "twoFactorAuth.enabledAt": 1 });

const User = mongoose.model("User", UserSchema);
export default User;
