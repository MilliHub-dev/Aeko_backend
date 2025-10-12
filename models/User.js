import mongoose from "mongoose";
import bcrypt from 'bcrypt';


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

const User = mongoose.model("User", UserSchema);
export default User;
