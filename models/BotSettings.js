import mongoose from "mongoose";

const botSettingsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true,
    index: true
  },
  botEnabled: { 
    type: Boolean, 
    default: false 
  },
  botPersonality: { 
    type: String, 
    enum: ["friendly", "professional", "sarcastic", "creative", "analytical", "mentor", "companion"], 
    default: "friendly" 
  },
  aiProvider: {
    type: String,
    enum: ["openai", "claude", "cohere", "local"],
    default: "openai"
  },
  model: {
    type: String,
    default: "gpt-4-turbo-preview"
  },
  maxTokens: {
    type: Number,
    default: 500,
    min: 50,
    max: 2000
  },
  contextLength: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 2
  },
  features: {
    contentModeration: { type: Boolean, default: true },
    sentimentAnalysis: { type: Boolean, default: true },
    contextAwareness: { type: Boolean, default: true },
    learningMode: { type: Boolean, default: true },
    imageGeneration: { type: Boolean, default: false },
    voiceResponse: { type: Boolean, default: false }
  },
  customInstructions: {
    type: String,
    maxlength: 500
  },
  responseStyle: {
    formal: { type: Boolean, default: false },
    concise: { type: Boolean, default: false },
    detailed: { type: Boolean, default: true },
    emojis: { type: Boolean, default: true }
  },
  restrictions: {
    topics: [String], // Topics to avoid
    words: [String],  // Words to filter
    maxDailyInteractions: { type: Number, default: 100 }
  },
  analytics: {
    totalInteractions: { type: Number, default: 0 },
    averageSentiment: { type: Number, default: 0 },
    favoriteTopics: [String],
    lastActive: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});


export default mongoose.model("BotSettings", botSettingsSchema);
