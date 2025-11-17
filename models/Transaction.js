import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['paystack', 'stripe', 'aeko_wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  providerResponse: {
    type: Object,
    default: {}
  },
  failureReason: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  isWithdrawn: {
    type: Boolean,
    default: false
  },
  withdrawalRequest: {
    requestedAt: Date,
    processedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    reference: String,
    failureReason: String
  }
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

export default Transaction;
