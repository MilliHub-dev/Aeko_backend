import mongoose from "mongoose";

const EnhancedMessageSchema = new mongoose.Schema(
  {
    sender: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    receiver: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    chatId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Chat", 
      required: true, 
      index: true 
    },
    groupId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Group", 
      default: null, 
      index: true 
    },
    
    // Message Content
    messageType: {
      type: String,
      enum: ["text", "voice", "image", "video", "file", "emoji", "sticker", "ai_response"],
      default: "text",
      required: true
    },
    content: { 
      type: String, 
      required: function() { 
        return this.messageType === "text" || this.messageType === "emoji" || this.messageType === "ai_response"; 
      }
    },
    
    // Voice Message Support
    voiceMessage: {
      url: { type: String }, // URL to voice file
      duration: { type: Number }, // Duration in seconds
      waveform: [Number], // Audio waveform data for visualization
      transcription: { type: String } // AI transcription of voice message
    },
    
    // Media Attachments
    attachments: [{
      type: { type: String, enum: ["image", "video", "file", "audio"] },
      url: { type: String, required: true },
      filename: { type: String },
      size: { type: Number }, // File size in bytes
      mimeType: { type: String },
      thumbnail: { type: String } // Thumbnail URL for videos/images
    }],
    
    // Emoji and Reactions
    emojis: [{ type: String }], // Array of emoji unicode
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: { type: String }, // Emoji unicode
      timestamp: { type: Date, default: Date.now }
    }],
    
    // AI Bot Related
    isBot: { type: Boolean, default: false },
    botPersonality: { 
      type: String, 
      enum: ["friendly", "professional", "sarcastic", "creative", "analytical", "mentor", "companion"],
      default: null 
    },
    aiProvider: { 
      type: String, 
      enum: ["openai", "claude", "cohere", "local"],
      default: null 
    },
    confidence: { type: Number, min: 0, max: 1 },
    
    // Message Status
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read", "failed"],
      default: "sending"
    },
    readBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now }
    }],
    
    // Message Features
    replyTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "EnhancedMessage", 
      default: null 
    },
    forwarded: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    
    // Metadata
    metadata: {
      clientId: { type: String }, // For message deduplication
      deviceType: { type: String, enum: ["web", "mobile", "desktop"] },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String }
      },
      mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      hashtags: [{ type: String }],
      links: [{
        url: { type: String },
        title: { type: String },
        description: { type: String },
        image: { type: String }
      }]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
EnhancedMessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
EnhancedMessageSchema.index({ chatId: 1, createdAt: -1 });
EnhancedMessageSchema.index({ messageType: 1 });
EnhancedMessageSchema.index({ isBot: 1 });
EnhancedMessageSchema.index({ status: 1 });

// Virtual for formatted timestamp
EnhancedMessageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString();
});

// Virtual for message preview
EnhancedMessageSchema.virtual('preview').get(function() {
  switch (this.messageType) {
    case 'text':
    case 'ai_response':
      return this.content.length > 50 ? this.content.substring(0, 50) + '...' : this.content;
    case 'voice':
      return '🎵 Voice message';
    case 'image':
      return '📷 Image';
    case 'video':
      return '🎥 Video';
    case 'file':
      return '📎 File';
    case 'emoji':
      return this.content;
    default:
      return 'Message';
  }
});

// Instance method to add reaction
EnhancedMessageSchema.methods.addReaction = function(userId, emoji) {
  const existingReaction = this.reactions.find(
    r => r.userId.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (existingReaction) {
    return false; // Already reacted with this emoji
  }
  
  this.reactions.push({ userId, emoji });
  return this.save();
};

// Instance method to remove reaction
EnhancedMessageSchema.methods.removeReaction = function(userId, emoji) {
  this.reactions = this.reactions.filter(
    r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
  );
  return this.save();
};

// Instance method to mark as read
EnhancedMessageSchema.methods.markAsRead = function(userId) {
  const alreadyRead = this.readBy.find(r => r.userId.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({ userId });
    this.status = 'read';
    return this.save();
  }
  
  return Promise.resolve(this);
};

const EnhancedMessage = mongoose.model("EnhancedMessage", EnhancedMessageSchema);
export default EnhancedMessage;