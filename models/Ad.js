import mongoose from 'mongoose';

const AdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  mediaType: { type: String, enum: ['image', 'video', 'text'], required: true },
  mediaUrl: { type: String },
  targetAudience: { type: Object }, // Example: { age: 18-35, location: "Nigeria", interests: ["sports", "tech"] }
  budget: { type: Number, required: true },
  advertiserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'running', 'completed'], default: 'pending' },
}, { timestamps: true });

const adSchema = new mongoose.Schema({
    ad_id: { type: String, required: true, unique: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 } // Click-through rate
});

const Ad = mongoose.model('Ad', AdSchema);
export default Ad;
