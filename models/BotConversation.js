import mongoose from "mongoose";

const botConversationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  userMessage: { 
    type: String, 
    required: true 
  },
  botResponse: { 
    type: String, 
    required: true 
  },
  personality: { 
    type: String, 
    enum: ["friendly", "professional", "sarcastic", "creative", "analytical", "mentor", "companion"],
    default: "friendly"
  },
  sentiment: { 
    type: String, 
    enum: ["positive", "negative", "neutral"],
    default: "neutral"
  },
  sentimentScore: { 
    type: Number, 
    default: 0 
  },
  aiProvider: { 
    type: String, 
    enum: ["openai", "claude", "cohere", "local"],
    default: "openai"
  },
  tokens: { 
    type: Number, 
    default: 0 
  },
  confidence: { 
    type: Number, 
    default: 0.9 
  },
  responseTime: { 
    type: Number, 
    default: 0 
  },
  isModerated: { 
    type: Boolean, 
    default: false 
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String
  }
}, {
  timestamps: true
});

// Indexes for performance
botConversationSchema.index({ userId: 1, createdAt: -1 });
botConversationSchema.index({ sentiment: 1 });
botConversationSchema.index({ personality: 1 });

export default mongoose.model("BotConversation", botConversationSchema);