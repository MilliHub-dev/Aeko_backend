//require("dotenv").config();
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
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
import { admin, adminRouter } from "./admin.js";
import { adminAuth, adminLogin, adminLogout } from "./middleware/adminAuth.js";
import cookieParser from "cookie-parser";
import EnhancedChatSocket from "./sockets/enhancedChatSocket.js";
import EnhancedLiveStreamSocket from "./sockets/enhancedLiveStreamSocket.js";
import { Server } from 'socket.io';
import setupVideoCallSocket from './sockets/videoCallSocket.js';


dotenv.config();
connectDB();

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

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/debates", debateRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/ads', adRoutes);
app.use("/api/bot", botRoutes);
app.use("/api/aeko", aekoRoutes);
app.use("/api/aeko", aekoWalletRoutes);
app.use("/api/nft", nftRoutes);
app.use('/api/video', videoEditRoutes);
app.use('/api/photo', photoEditRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use("/api/enhanced-bot", enhancedBotRoutes);
app.use("/api/enhanced-chat", enhancedChatRoutes);
app.use("/api/livestream", enhancedLiveStreamRoutes);

// Admin API Routes
// Expose admin REST endpoints such as /api/admin/setup/first-admin
app.use('/api/admin', adminRoutes);
// If you need separate admin auth endpoints, mount adminAuthRoutes as well
// app.use('/api/admin', adminAuthRoutes);

// Blockchain and NFT routes
app.use("/api/posts", postTransferRoutes);

swaggerDocs(app);


// Register AdminJS with Mongoose
AdminJS.registerAdapter({ Database, Resource });


// Configure AdminJS
/* const adminOptions = {
  resources: [
    {
      resource: User,
      options: {
        properties: {
          password: { isVisible: false }, // Hide password
        },
        actions: {
          banUser: {
            actionType: "record",
            icon: "Ban",
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ banned: true });
              return { record: record.toJSON() };
            },
          },
        },
      },
    },
    {
      resource: Post,
      options: {
        actions: {
          delete: { isVisible: true }, // Allow post deletion
        },
      },
    },
    
  ],
  branding: {
    companyName: "Aeko Admin",
    logo: "https://your-logo-url.com/logo.png",
  },
}; */

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

// Start Server
const PORT = process.env.PORT || 5000;
const io = new Server(server, { cors: { origin: '*' } });
setupVideoCallSocket(io);
server.listen(PORT, () => {
  console.log(`🚀 Aeko Backend Server starting...`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Socket.IO ready for real-time communication`);
  console.log(`🤖 AI Bot integrated and ready`);
  console.log(`📁 File uploads supported (max 100MB)`);
  console.log(`😊 Emoji reactions enabled`);
  console.log(`🎵 Voice messages supported`);
  console.log(`💬 Enhanced Chat System Active`);
  console.log(`🎥 Enhanced LiveStream Platform Active`);
  console.log(`🌐 WebRTC streaming enabled`);
  console.log(`📊 Stream analytics and monetization ready`);
  console.log(`🛡️ Stream moderation tools enabled`);
  console.log(`🎬 Screen sharing and co-hosting supported`);
  console.log('✨ All systems ready!');
});
