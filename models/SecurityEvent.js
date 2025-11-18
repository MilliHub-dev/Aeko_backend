import mongoose from "mongoose";

const SecurityEventSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true
  },
  eventType: { 
    type: String, 
    enum: [
      "block", 
      "unblock", 
      "privacy_change", 
      "follow_request_sent",
      "follow_request_approved",
      "follow_request_rejected",
      "2fa_enabled", 
      "2fa_disabled", 
      "2fa_used", 
      "backup_code_used",
      "backup_codes_generated"
    ],
    required: true,
    index: true
  },
  targetUser: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    index: true
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: { 
    type: String,
    required: true
  },
  userAgent: { 
    type: String,
    required: true
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  }
}, { 
  timestamps: true,
  // Automatically remove old events after 1 year for performance
  expireAfterSeconds: 365 * 24 * 60 * 60
});

// Compound indexes for efficient querying
SecurityEventSchema.index({ user: 1, eventType: 1, timestamp: -1 });
SecurityEventSchema.index({ user: 1, timestamp: -1 });
SecurityEventSchema.index({ eventType: 1, timestamp: -1 });
SecurityEventSchema.index({ targetUser: 1, timestamp: -1 });

// Static method to log security events
SecurityEventSchema.statics.logEvent = async function(eventData) {
  try {
    const event = new this({
      user: eventData.user,
      eventType: eventData.eventType,
      targetUser: eventData.targetUser || null,
      metadata: eventData.metadata || {},
      ipAddress: eventData.ipAddress,
      userAgent: eventData.userAgent,
      success: eventData.success !== undefined ? eventData.success : true,
      errorMessage: eventData.errorMessage || null
    });
    
    await event.save();
    return event;
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw error to prevent breaking main functionality
    return null;
  }
};

// Static method to get user security events with pagination
SecurityEventSchema.statics.getUserEvents = async function(userId, options = {}) {
  const {
    eventType = null,
    page = 1,
    limit = 50,
    startDate = null,
    endDate = null
  } = options;
  
  const query = { user: userId };
  
  if (eventType) {
    query.eventType = eventType;
  }
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [events, total] = await Promise.all([
    this.find(query)
      .populate('targetUser', 'username name')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    events,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get security statistics
SecurityEventSchema.statics.getSecurityStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return stats;
};

// Instance method to format event for display
SecurityEventSchema.methods.getDisplayMessage = function() {
  const eventMessages = {
    'block': `Blocked user ${this.targetUser?.username || 'unknown'}`,
    'unblock': `Unblocked user ${this.targetUser?.username || 'unknown'}`,
    'privacy_change': 'Updated privacy settings',
    'follow_request_sent': `Sent follow request to ${this.targetUser?.username || 'unknown'}`,
    'follow_request_approved': `Approved follow request from ${this.targetUser?.username || 'unknown'}`,
    'follow_request_rejected': `Rejected follow request from ${this.targetUser?.username || 'unknown'}`,
    '2fa_enabled': 'Enabled two-factor authentication',
    '2fa_disabled': 'Disabled two-factor authentication',
    '2fa_used': 'Used two-factor authentication for login',
    'backup_code_used': 'Used backup code for authentication',
    'backup_codes_generated': 'Generated new backup codes'
  };
  
  return eventMessages[this.eventType] || `Unknown security event: ${this.eventType}`;
};

const SecurityEvent = mongoose.model("SecurityEvent", SecurityEventSchema);
export default SecurityEvent;