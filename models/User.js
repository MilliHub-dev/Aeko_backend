import mongoose from "mongoose";
import bcrypt from 'bcrypt';


const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare passwords
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", UserSchema);
export default User;
