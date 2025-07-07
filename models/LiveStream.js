import mongoose from "mongoose";

const LiveStreamSchema = new mongoose.Schema(
  {
    // Stream Basic Info
    title: { 
      type: String, 
      required: true, 
      maxlength: 100,
      index: true 
    },
    description: { 
      type: String, 
      maxlength: 500 
    },
    thumbnail: { 
      type: String,
      default: null 
    },
    
    // Host Information
    host: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true 
    },
    hostName: { 
      type: String, 
      required: true 
    },
    hostProfilePicture: { 
      type: String 
    },
    
    // Stream Status and Type
    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "paused", "recording"],
      default: "scheduled",
      index: true
    },
    streamType: {
      type: String,
      enum: ["public", "private", "followers_only", "paid"],
      default: "public"
    },
    category: {
      type: String,
      enum: ["gaming", "music", "education", "entertainment", "sports", "news", "technology", "lifestyle", "cooking", "art", "other"],
      default: "other",
      index: true
    },
    
    // Stream Technical Details
    streamKey: { 
      type: String, 
      unique: true,
      index: true 
    },
    rtmpUrl: { 
      type: String 
    },
    hlsUrl: { 
      type: String 
    },
    webrtcUrl: { 
      type: String 
    },
    roomId: { 
      type: String, 
      unique: true,
      index: true 
    },
    
    // Stream Quality and Settings
    quality: {
      resolution: { 
        type: String, 
        enum: ["360p", "480p", "720p", "1080p", "1440p", "4K"],
        default: "720p" 
      },
      bitrate: { 
        type: Number, 
        default: 2500 
      },
      fps: { 
        type: Number, 
        enum: [24, 30, 60],
        default: 30 
      },
      codec: { 
        type: String, 
        enum: ["H.264", "H.265", "VP9"],
        default: "H.264" 
      }
    },
    
    // Stream Features
    features: {
      chatEnabled: { 
        type: Boolean, 
        default: true 
      },
      reactionsEnabled: { 
        type: Boolean, 
        default: true 
      },
      screenShareEnabled: { 
        type: Boolean, 
        default: false 
      },
      recordingEnabled: { 
        type: Boolean, 
        default: false 
      },
      donationsEnabled: { 
        type: Boolean, 
        default: false 
      },
      subscribersOnly: { 
        type: Boolean, 
        default: false 
      },
      moderationEnabled: { 
        type: Boolean, 
        default: true 
      }
    },
    
    // Scheduling
    scheduledFor: { 
      type: Date,
      index: true 
    },
    startedAt: { 
      type: Date,
      index: true 
    },
    endedAt: { 
      type: Date 
    },
    duration: { 
      type: Number, // in seconds
      default: 0 
    },
    
    // Viewers and Engagement
    currentViewers: { 
      type: Number, 
      default: 0 
    },
    peakViewers: { 
      type: Number, 
      default: 0 
    },
    totalViews: { 
      type: Number, 
      default: 0 
    },
    uniqueViewers: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    
    // Reactions and Engagement
    reactions: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },
      emoji: { 
        type: String 
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      }
    }],
    likes: { 
      type: Number, 
      default: 0 
    },
    likedBy: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    
    // Monetization
    monetization: {
      ticketPrice: { 
        type: Number, 
        default: 0 
      },
      currency: { 
        type: String, 
        default: "USD" 
      },
      totalEarnings: { 
        type: Number, 
        default: 0 
      },
      donations: [{
        userId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User" 
        },
        amount: { 
          type: Number 
        },
        message: { 
          type: String 
        },
        timestamp: { 
          type: Date, 
          default: Date.now 
        }
      }],
      subscribers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      }]
    },
    
    // Recording and Archive
    recording: {
      isRecording: { 
        type: Boolean, 
        default: false 
      },
      recordingUrl: { 
        type: String 
      },
      recordingSize: { 
        type: Number // in bytes
      },
      segments: [{
        url: { 
          type: String 
        },
        duration: { 
          type: Number 
        },
        timestamp: { 
          type: Date 
        }
      }]
    },
    
    // Moderation
    moderation: {
      moderators: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      }],
      bannedUsers: [{ 
        userId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User" 
        },
        bannedAt: { 
          type: Date, 
          default: Date.now 
        },
        reason: { 
          type: String 
        }
      }],
      chatSettings: {
        slowMode: { 
          type: Number, 
          default: 0 // seconds between messages
        },
        followersOnly: { 
          type: Boolean, 
          default: false 
        },
        subscribersOnly: { 
          type: Boolean, 
          default: false 
        },
        autoModeration: { 
          type: Boolean, 
          default: true 
        }
      }
    },
    
    // Analytics
    analytics: {
      averageWatchTime: { 
        type: Number, 
        default: 0 // in seconds
      },
      chatMessages: { 
        type: Number, 
        default: 0 
      },
      shares: { 
        type: Number, 
        default: 0 
      },
      bounceRate: { 
        type: Number, 
        default: 0 // percentage
      },
      topCountries: [{ 
        country: String, 
        viewers: Number 
      }],
      deviceStats: {
        mobile: { 
          type: Number, 
          default: 0 
        },
        desktop: { 
          type: Number, 
          default: 0 
        },
        tablet: { 
          type: Number, 
          default: 0 
        }
      }
    },
    
    // Technical Metadata
    metadata: {
      streamProtocol: { 
        type: String, 
        enum: ["RTMP", "WebRTC", "HLS", "DASH"],
        default: "WebRTC" 
      },
      encodingSettings: {
        audioCodec: { 
          type: String, 
          default: "AAC" 
        },
        audioBitrate: { 
          type: Number, 
          default: 128 
        },
        audioSampleRate: { 
          type: Number, 
          default: 44100 
        }
      },
      networkStats: {
        uploadSpeed: { 
          type: Number 
        },
        latency: { 
          type: Number 
        },
        droppedFrames: { 
          type: Number, 
          default: 0 
        }
      }
    },
    
    // Stream Tags and Discovery
    tags: [{ 
      type: String, 
      maxlength: 20 
    }],
    language: { 
      type: String, 
      default: "en" 
    },
    mature: { 
      type: Boolean, 
      default: false 
    },
    
    // Collaboration
    coHosts: [{ 
      user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },
      permissions: [{
        type: String,
        enum: ["chat_moderate", "video_control", "audio_control", "screen_share", "invite_guests"]
      }],
      joinedAt: { 
        type: Date, 
        default: Date.now 
      }
    }],
    
    // Guest Management
    guests: [{
      user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },
      status: { 
        type: String, 
        enum: ["invited", "joined", "left", "removed"],
        default: "invited" 
      },
      audioEnabled: { 
        type: Boolean, 
        default: true 
      },
      videoEnabled: { 
        type: Boolean, 
        default: true 
      },
      invitedAt: { 
        type: Date, 
        default: Date.now 
      },
      joinedAt: { 
        type: Date 
      }
    }],
    
    // Stream Health
    health: {
      connectionStatus: { 
        type: String, 
        enum: ["excellent", "good", "poor", "unstable"],
        default: "good" 
      },
      issues: [{
        type: { 
          type: String, 
          enum: ["audio_loss", "video_lag", "connection_drop", "encoding_error"] 
        },
        timestamp: { 
          type: Date, 
          default: Date.now 
        },
        resolved: { 
          type: Boolean, 
          default: false 
        }
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
LiveStreamSchema.index({ host: 1, status: 1 });
LiveStreamSchema.index({ status: 1, category: 1 });
LiveStreamSchema.index({ scheduledFor: 1 });
LiveStreamSchema.index({ startedAt: -1 });
LiveStreamSchema.index({ streamType: 1, status: 1 });
LiveStreamSchema.index({ "tags": 1 });
LiveStreamSchema.index({ currentViewers: -1 });
LiveStreamSchema.index({ totalViews: -1 });

// Virtual for stream duration in human readable format
LiveStreamSchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return '0:00';
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for viewer engagement rate
LiveStreamSchema.virtual('engagementRate').get(function() {
  if (this.totalViews === 0) return 0;
  return ((this.analytics.chatMessages + this.likes + this.reactions.length) / this.totalViews * 100).toFixed(2);
});

// Instance method to add viewer
LiveStreamSchema.methods.addViewer = function(userId) {
  if (!this.uniqueViewers.includes(userId)) {
    this.uniqueViewers.push(userId);
  }
  this.currentViewers += 1;
  this.totalViews += 1;
  if (this.currentViewers > this.peakViewers) {
    this.peakViewers = this.currentViewers;
  }
  return this.save();
};

// Instance method to remove viewer
LiveStreamSchema.methods.removeViewer = function() {
  this.currentViewers = Math.max(0, this.currentViewers - 1);
  return this.save();
};

// Instance method to add reaction
LiveStreamSchema.methods.addReaction = function(userId, emoji) {
  this.reactions.push({ userId, emoji });
  return this.save();
};

// Instance method to toggle like
LiveStreamSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likedBy.indexOf(userId);
  if (likeIndex > -1) {
    this.likedBy.splice(likeIndex, 1);
    this.likes = Math.max(0, this.likes - 1);
  } else {
    this.likedBy.push(userId);
    this.likes += 1;
  }
  return this.save();
};

// Instance method to start stream
LiveStreamSchema.methods.startStream = function() {
  this.status = 'live';
  this.startedAt = new Date();
  return this.save();
};

// Instance method to end stream
LiveStreamSchema.methods.endStream = function() {
  this.status = 'ended';
  this.endedAt = new Date();
  if (this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  return this.save();
};

// Instance method to add moderator
LiveStreamSchema.methods.addModerator = function(userId) {
  if (!this.moderation.moderators.includes(userId)) {
    this.moderation.moderators.push(userId);
  }
  return this.save();
};

// Instance method to ban user
LiveStreamSchema.methods.banUser = function(userId, reason = '') {
  this.moderation.bannedUsers.push({
    userId,
    reason,
    bannedAt: new Date()
  });
  return this.save();
};

// Static method to get trending streams
LiveStreamSchema.statics.getTrending = function(limit = 10) {
  return this.find({ status: 'live' })
    .sort({ currentViewers: -1, totalViews: -1 })
    .limit(limit)
    .populate('host', 'username profilePicture verified')
    .exec();
};

// Static method to get streams by category
LiveStreamSchema.statics.getByCategory = function(category, limit = 20) {
  return this.find({ 
    status: 'live', 
    category,
    streamType: 'public' 
  })
    .sort({ currentViewers: -1 })
    .limit(limit)
    .populate('host', 'username profilePicture verified')
    .exec();
};

// Static method to search streams
LiveStreamSchema.statics.searchStreams = function(query, filters = {}) {
  const searchQuery = {
    status: 'live',
    streamType: 'public',
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
      { hostName: { $regex: query, $options: 'i' } }
    ]
  };

  if (filters.category) {
    searchQuery.category = filters.category;
  }
  
  if (filters.language) {
    searchQuery.language = filters.language;
  }

  return this.find(searchQuery)
    .sort({ currentViewers: -1, totalViews: -1 })
    .limit(filters.limit || 20)
    .populate('host', 'username profilePicture verified')
    .exec();
};

const LiveStream = mongoose.model("LiveStream", LiveStreamSchema);
export default LiveStream;