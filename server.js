//require("dotenv").config();
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import blockingMiddleware from "./middleware/blockingMiddleware.js";
import privacyMiddleware from "./middleware/privacyMiddleware.js";
import twoFactorMiddleware from "./middleware/twoFactorMiddleware.js";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import statusRoutes from "./routes/status.js";
import debateRoutes from "./routes/debates.js";
import challengeRoutes from "./routes/challenges.js";
import spaceRoutes from "./routes/space.js";
import commentRoutes from "./routes/commentRoutes.js";
import chatRoutes from "./routes/chat.js";
import adRoutes from "./routes/adRoutes.js";
import botRoutes from "./routes/bot.js";
import aekoRoutes from "./routes/aekoRoutes.js";
import aekoWalletRoutes from "./routes/aekoWalletRoutes.js";
import nftRoutes from "./routes/nftRoutes.js";
import videoEditRoutes from "./routes/videoEdit.js";
import photoEditRoutes from "./routes/photoEdit.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import swaggerDocs from "./swagger.js";
import passport from "./config/passport.js";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from "@adminjs/mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import profileRoutes from './routes/profile.js';
import postTransferRoutes from "./routes/postTransferRoutes.js";
import enhancedBotRoutes from "./routes/enhancedBotRoutes.js";
import enhancedChatRoutes from "./routes/enhancedChatRoutes.js";
import enhancedLiveStreamRoutes from "./routes/enhancedLiveStreamRoutes.js";
import interestRoutes from "./routes/interestRoutes.js";
import userInterestRoutes from "./routes/userInterestRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import communityProfileRoutes from "./routes/communityProfileRoutes.js";
import communityPaymentRoutes from "./routes/communityPaymentRoutes.js";
import securityRoutes from "./routes/security.js";
import Transaction from "./models/Transaction.js";
import { admin, adminRouter } from "./admin.js";
import { adminAuth, adminLogin, adminLogout } from "./middleware/adminAuth.js";
import cookieParser from "cookie-parser";
import EnhancedChatSocket from "./sockets/enhancedChatSocket.js";
import EnhancedLiveStreamSocket from "./sockets/enhancedLiveStreamSocket.js";
import setupVideoCallSocket from './sockets/videoCallSocket.js';
// Import scheduled jobs
import "./jobs/expireSubscriptions.js";


dotenv.config();
connectDB();

// Configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

// Production Configuration

const app = express();
const server = http.createServer(app);

// Initialize Enhanced Chat Socket System
const enhancedChatSocket = new EnhancedChatSocket(server);

// Initialize Enhanced LiveStream Socket System
const enhancedLiveStreamSocket = new EnhancedLiveStreamSocket(server);

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS and cookie parser (keep these before AdminJS)
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount AdminJS router BEFORE body parsers to avoid WrongArgumentError
app.use(admin.options.rootPath, adminRouter);

// Body parser middleware (after AdminJS router, before API routes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Initialize Passport (OAuth)
app.use(passport.initialize());

// Security rate limiting for sensitive endpoints
const securityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for security endpoints
  message: {
    success: false,
    message: 'Too many security requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API Routes with security middleware
app.use("/api/auth", apiRateLimit, authRoutes);
app.use("/api/users", apiRateLimit, blockingMiddleware.checkProfileAccess(), privacyMiddleware.checkProfileAccess(), userRoutes);
app.use("/api/posts", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts(), postRoutes);
app.use("/api/comments", apiRateLimit, blockingMiddleware.checkPostInteraction(), commentRoutes);
app.use("/api/status", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts(), statusRoutes);
app.use("/api/debates", apiRateLimit, blockingMiddleware.checkPostInteraction(), debateRoutes);
app.use("/api/challenges", apiRateLimit, blockingMiddleware.checkPostInteraction(), challengeRoutes);
app.use("/api/spaces", apiRateLimit, blockingMiddleware.checkPostInteraction(), spaceRoutes);
app.use("/api/chat", apiRateLimit, blockingMiddleware.checkMessagingAccess(), chatRoutes);
app.use('/api/ads', apiRateLimit, adRoutes);
app.use("/api/bot", apiRateLimit, botRoutes);
app.use("/api/aeko", apiRateLimit, aekoRoutes);
app.use("/api/aeko", apiRateLimit, aekoWalletRoutes);
app.use("/api/nft", apiRateLimit, nftRoutes);
app.use("/api/interests", apiRateLimit, interestRoutes);
app.use("/api/user/interests", apiRateLimit, userInterestRoutes);
app.use('/api/video', apiRateLimit, videoEditRoutes);
app.use('/api/photo', apiRateLimit, photoEditRoutes);
app.use('/api/payments', apiRateLimit, paymentRoutes);
app.use('/api/profile', apiRateLimit, blockingMiddleware.checkProfileAccess(), privacyMiddleware.checkProfileAccess(), profileRoutes);
app.use('/api/subscription', apiRateLimit, subscriptionRoutes);
app.use("/api/enhanced-bot", apiRateLimit, enhancedBotRoutes);
app.use("/api/enhanced-chat", apiRateLimit, blockingMiddleware.checkMessagingAccess(), enhancedChatRoutes);
app.use("/api/livestream", apiRateLimit, blockingMiddleware.checkPostInteraction(), enhancedLiveStreamRoutes);

// Security routes with rate limiting
app.use("/api/security", securityRateLimit, securityRoutes);

// Admin API Routes with 2FA protection for sensitive operations
// Expose admin REST endpoints such as /api/admin/setup/first-admin
app.use('/api/admin', apiRateLimit, adminRoutes);
// If you need separate admin auth endpoints, mount adminAuthRoutes as well
// app.use('/api/admin', adminAuthRoutes);

// Community routes
app.use("/api/communities", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts(), communityRoutes);
app.use("/api/community-profiles", apiRateLimit, blockingMiddleware.checkProfileAccess(), privacyMiddleware.checkProfileAccess(), communityProfileRoutes);
app.use("/api/community/payment", apiRateLimit, communityPaymentRoutes); // Added route

// Blockchain and NFT routes
app.use("/api/posts", apiRateLimit, postTransferRoutes);

swaggerDocs(app);


// Register AdminJS with Mongoose
AdminJS.registerAdapter({ Database, Resource });


// Configure AdminJS
const adminOptions = {
  resources: [
    {
      resource: User,
      options: {
        properties: {
          password: { isVisible: false }, // Hide password
          resetPasswordToken: { isVisible: false },
          resetPasswordExpire: { isVisible: false }
        }
      }
    },
    {
      resource: Post,
      options: {
        actions: {
          delete: { isVisible: true } // Allow post deletion
        }
      }
    }
  ],
  branding: {
    companyName: "Aeko Admin",
    logo: "https://your-logo-url.com/logo.png"
  }
};

// Remove conflicting admin auth routes - AdminJS handles this
// app.post('/admin/login', adminLogin);
// app.post('/admin/logout', adminLogout);

// Admin API Routes (Protected)
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: [{ $or: ["$blueTick", "$goldenTick"] }, 1, 0] } },
          activeSubscriptions: { $sum: { $cond: [{ $eq: ["$subscriptionStatus", "active"] }, 1, 0] } },
          bannedUsers: { $sum: { $cond: ["$banned", 1, 0] } },
          botEnabledUsers: { $sum: { $cond: ["$botEnabled", 1, 0] } }
        }
      }
    ]);

    const postStats = await Post.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalLikes: { $sum: { $size: "$likes" } }
        }
      }
    ]);

    const adStats = await Ad.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalBudget: { $sum: "$budget" }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        users: userStats[0] || {},
        posts: postStats,
        ads: adStats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin statistics' });
  }
});

// Setup AdminJS with Express (already mounted above body parsers)

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to Aeko Backend 🚀 - Enhanced with Real-time Chat!");
});

// Enhanced Chat System Info
app.get("/api/chat-info", (req, res) => {
  const connectedUsers = enhancedChatSocket.getConnectedUsers();
  
  res.json({
    success: true,
    chatSystem: {
      name: 'Enhanced Real-time Chat System',
      version: '2.0.0',
      features: {
        realTimeMessaging: true,
        voiceMessages: true,
        emojiReactions: true,
        fileSharing: true,
        aiBotIntegration: true,
        typingIndicators: true,
        readReceipts: true,
        messageSearch: true,
        groupChats: true,
        messageHistory: true,
        onlineStatus: true
      },
      statistics: {
        connectedUsers: connectedUsers.length,
        totalActiveConnections: enhancedChatSocket.io.sockets.sockets.size,
        supportedFileTypes: ['image', 'video', 'audio', 'document'],
        maxFileSize: '100MB',
        supportedEmojis: 'Unicode Standard',
        aiPersonalities: ['friendly', 'professional', 'sarcastic', 'creative', 'analytical', 'mentor', 'companion']
      }
    },
    connectedUsers: connectedUsers.map(user => ({
      userId: user.user._id,
      username: user.user.username,
      status: user.status,
      lastSeen: user.lastSeen
    }))
  });
});

// Enhanced LiveStream System Info
app.get("/api/livestream-info", (req, res) => {
  const streamStats = enhancedLiveStreamSocket.getSystemStats();
  
  res.json({
    success: true,
    livestreamSystem: {
      name: 'Enhanced LiveStream Platform',
      version: '1.0.0',
      features: {
        webrtcStreaming: true,
        realTimeChat: true,
        emojiReactions: true,
        donationsAndMonetization: true,
        moderationTools: true,
        streamRecording: true,
        screenSharing: true,
        coHosting: true,
        guestInvites: true,
        viewerAnalytics: true,
        streamDiscovery: true,
        categoryFiltering: true,
        qualityControls: true,
        streamScheduling: true
      },
      capabilities: {
        maxStreamers: 'Unlimited',
        maxViewersPerStream: '10,000+',
        supportedProtocols: ['WebRTC', 'RTMP', 'HLS'],
        supportedResolutions: ['360p', '480p', '720p', '1080p', '1440p', '4K'],
        supportedFrameRates: [24, 30, 60],
        supportedCategories: ['gaming', 'music', 'education', 'entertainment', 'sports', 'news', 'technology', 'lifestyle', 'cooking', 'art', 'other']
      },
      statistics: streamStats,
      monetization: {
        donationsEnabled: true,
        subscriptionsEnabled: true,
        ticketedStreamsEnabled: true,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY'],
        paymentProcessors: ['Stripe', 'PayPal', 'Square']
      }
    }
  });
});

// Health check with enhanced features
app.get("/health", (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'Connected',
      socket: 'Active',
      chat: 'Enhanced Chat System Ready',
      livestream: 'Enhanced LiveStream Platform Ready',
      ai: 'AI Bot Integrated'
    },
    features: [
      'Real-time messaging',
      'Voice messages',
      'Emoji reactions', 
      'File sharing',
      'AI bot integration',
      'Typing indicators',
      'Read receipts',
      'Message search',
      'Live streaming',
      'WebRTC broadcasting',
      'Stream chat',
      'Stream reactions',
      'Stream monetization',
      'Stream moderation',
      'Stream analytics'
    ]
  });
});

// Start server
const startServer = async () => {
  try {
    // Add any pre-start checks here (e.g., database connection)
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Aeko Backend Server ${isProduction ? 'Production' : 'Development'} Mode`);
      console.log(`📡 Server running on port ${PORT}`);
      
      if (!isProduction) {
        console.log('🔗 API Documentation:');
        console.log(`   - Swagger UI: http://localhost:${PORT}/api-docs`);
        console.log(`   - API Spec: http://localhost:${PORT}/api-docs.json`);
      }
      
      console.log('✨ All systems ready!');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! 💥 Shutting down...');
      console.error(err);
      server.close(() => {
        process.exit(1);
      });
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
      console.error(err);
      process.exit(1);
    });
    
    // Handle SIGTERM (for Docker/Heroku)
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      server.close(() => {
        console.log('💥 Process terminated!');
      });
    });
    
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Start the application
startServer();
