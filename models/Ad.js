import mongoose from 'mongoose';

const AdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video', 'text', 'carousel'], required: true },
  mediaUrl: { type: String },
  mediaUrls: [{ type: String }], // For carousel ads
  targetAudience: {
    age: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 65 }
    },
    location: [{ type: String }], // Array of countries/cities
    interests: [{ type: String }], // Array of interest categories
    gender: { type: String, enum: ['all', 'male', 'female', 'other'], default: 'all' },
    language: [{ type: String }], // Preferred languages
    deviceType: [{ type: String, enum: ['mobile', 'desktop', 'tablet'] }],
    followersRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 1000000 }
    }
  },
  budget: { 
    total: { type: Number, required: true },
    daily: { type: Number },
    spent: { type: Number, default: 0 },
    currency: { type: String, enum: ['USD', 'AEKO'], default: 'USD' }
  },
  pricing: {
    model: { type: String, enum: ['cpm', 'cpc', 'cpa'], default: 'cpm' }, // Cost per thousand, click, action
    bidAmount: { type: Number, required: true },
    maxBid: { type: Number }
  },
  campaign: {
    objective: { type: String, enum: ['awareness', 'traffic', 'engagement', 'conversions', 'app_installs'], required: true },
    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      timezone: { type: String, default: 'UTC' },
      dayParting: {
        enabled: { type: Boolean, default: false },
        hours: [{ type: Number }] // Hours of day when ad should run (0-23)
      }
    }
  },
  advertiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected', 'running', 'paused', 'completed', 'expired'], 
    default: 'draft' 
  },
  callToAction: {
    type: { type: String, enum: ['learn_more', 'shop_now', 'sign_up', 'download', 'contact_us', 'visit_website'], default: 'learn_more' },
    url: { type: String },
    text: { type: String }
  },
  analytics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }, // Click-through rate
    conversions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    reach: { type: Number, default: 0 }, // Unique users reached
    frequency: { type: Number, default: 0 }, // Average times shown to same user
    engagements: {
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      saves: { type: Number, default: 0 }
    },
    demographics: {
      age: [{
        range: String, // "18-24", "25-34", etc.
        count: Number
      }],
      gender: [{
        type: String,
        count: Number
      }],
      location: [{
        country: String,
        count: Number
      }]
    },
    performance: {
      bestPerformingTime: { type: String }, // "14:00-16:00"
      topLocations: [{ type: String }],
      topDevices: [{ type: String }]
    }
  },
  review: {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    feedback: { type: String }
  },
  placement: {
    feed: { type: Boolean, default: true },
    stories: { type: Boolean, default: false },
    sidebar: { type: Boolean, default: false },
    inStream: { type: Boolean, default: false }
  },
  frequency: {
    cap: { type: Number, default: 3 }, // Max times to show to same user
    currentCap: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for ad performance score
AdSchema.virtual('performanceScore').get(function() {
  if (this.analytics.impressions === 0) return 0;
  
  const ctr = this.analytics.ctr;
  const conversionRate = this.analytics.conversionRate;
  const engagementRate = (
    this.analytics.engagements.likes + 
    this.analytics.engagements.shares + 
    this.analytics.engagements.comments
  ) / this.analytics.impressions;
  
  return Math.round((ctr * 0.4 + conversionRate * 0.4 + engagementRate * 0.2) * 100);
});

// Virtual for remaining budget
AdSchema.virtual('remainingBudget').get(function() {
  return this.budget.total - this.budget.spent;
});

// Virtual for days remaining
AdSchema.virtual('daysRemaining').get(function() {
  if (!this.campaign.schedule.endDate) return 0;
  const now = new Date();
  const endDate = new Date(this.campaign.schedule.endDate);
  const diffTime = endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update analytics
AdSchema.pre('save', function(next) {
  // Update CTR
  if (this.analytics.impressions > 0) {
    this.analytics.ctr = (this.analytics.clicks / this.analytics.impressions * 100).toFixed(2);
  }
  
  // Update conversion rate
  if (this.analytics.clicks > 0) {
    this.analytics.conversionRate = (this.analytics.conversions / this.analytics.clicks * 100).toFixed(2);
  }
  
  // Update frequency
  if (this.analytics.impressions > 0 && this.analytics.reach > 0) {
    this.analytics.frequency = (this.analytics.impressions / this.analytics.reach).toFixed(2);
  }
  
  // Auto-pause if budget exhausted
  if (this.budget.spent >= this.budget.total && this.status === 'running') {
    this.status = 'completed';
  }
  
  // Auto-expire if end date passed
  const now = new Date();
  if (this.campaign.schedule.endDate && now > this.campaign.schedule.endDate && this.status === 'running') {
    this.status = 'expired';
  }
  
  next();
});

// Static method to get ads for user based on targeting
AdSchema.statics.getTargetedAds = async function(user, limit = 5) {
  const query = {
    status: 'running',
    'campaign.schedule.startDate': { $lte: new Date() },
    'campaign.schedule.endDate': { $gte: new Date() },
    'budget.spent': { $lt: this.budget?.total || 0 }
  };
  
  // Add targeting filters if user data available
  if (user) {
    // Age targeting (assuming user has age field)
    if (user.age) {
      query['targetAudience.age.min'] = { $lte: user.age };
      query['targetAudience.age.max'] = { $gte: user.age };
    }
    
    // Location targeting
    if (user.location) {
      query['targetAudience.location'] = { $in: [user.location] };
    }
    
    // Followers targeting
    if (user.followers && user.followers.length) {
      query['targetAudience.followersRange.min'] = { $lte: user.followers.length };
      query['targetAudience.followersRange.max'] = { $gte: user.followers.length };
    }
  }
  
  return this.find(query)
    .populate('advertiserId', 'username profilePicture blueTick')
    .sort({ 'pricing.bidAmount': -1, createdAt: -1 })
    .limit(limit);
};

// Method to record impression
AdSchema.methods.recordImpression = async function(userId, metadata = {}) {
  this.analytics.impressions += 1;
  
  // Track unique reach
  if (!this.viewedBy || !this.viewedBy.includes(userId)) {
    this.analytics.reach += 1;
    if (!this.viewedBy) this.viewedBy = [];
    this.viewedBy.push(userId);
  }
  
  // Update demographics if metadata provided
  if (metadata.age) {
    const ageRange = this.getAgeRange(metadata.age);
    const existingAge = this.analytics.demographics.age.find(a => a.range === ageRange);
    if (existingAge) {
      existingAge.count += 1;
    } else {
      this.analytics.demographics.age.push({ range: ageRange, count: 1 });
    }
  }
  
  await this.save();
};

// Method to record click
AdSchema.methods.recordClick = async function(userId, metadata = {}) {
  this.analytics.clicks += 1;
  
  // Update budget
  if (this.pricing.model === 'cpc') {
    this.budget.spent += this.pricing.bidAmount;
  }
  
  await this.save();
};

// Method to record conversion
AdSchema.methods.recordConversion = async function(userId, conversionValue = 0) {
  this.analytics.conversions += 1;
  
  // Update budget for CPA model
  if (this.pricing.model === 'cpa') {
    this.budget.spent += this.pricing.bidAmount;
  }
  
  await this.save();
};

// Helper method to get age range
AdSchema.methods.getAgeRange = function(age) {
  if (age < 18) return 'under-18';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
};

// Add indexes for performance
AdSchema.index({ status: 1, 'campaign.schedule.startDate': 1, 'campaign.schedule.endDate': 1 });
AdSchema.index({ advertiserId: 1, status: 1 });
AdSchema.index({ 'targetAudience.location': 1 });
AdSchema.index({ 'targetAudience.interests': 1 });
AdSchema.index({ 'pricing.bidAmount': -1 });

const Ad = mongoose.model('Ad', AdSchema);
export default Ad;
