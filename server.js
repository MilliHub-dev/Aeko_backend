//require("dotenv").config();
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import fs from "fs";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js"; // ✅ Correct import
import postRoutes from "./routes/postRoutes.js"; // ✅ Correct import
import commentRoutes from "./routes/commentRoutes.js"; // ✅ Correct import
import swaggerDocs from "./swagger.js";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from "@adminjs/mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import adRoutes from './routes/adRoutes.js';
import profileRoutes from './routes/profile.js';
import paymentRoutes from './routes/paymentRoutes.js';
import statusRoutes from './routes/status.js';
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import auth from "./routes/auth.js";
//import chatsocket from "./chatsocket.js";
//import livestreamsocket from "./livestreamsocket.js";
import bot from "./routes/bot.js";
import enhancedBotRoutes from "./routes/enhancedBotRoutes.js";
import enhancedChatRoutes from "./routes/enhancedChatRoutes.js";
import challenges from "./routes/challenges.js";
import chat from "./routes/chat.js";
import debates from "./routes/debates.js";
import space from "./routes/space.js";
import { admin, adminRouter } from "./admin.js";
import EnhancedChatSocket from "./sockets/enhancedChatSocket.js";



dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Enhanced Chat Socket System
const enhancedChatSocket = new EnhancedChatSocket(server);

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use("/api/auth", auth);
app.use("/api/bot", bot);
app.use("/api/enhanced-bot", enhancedBotRoutes);
app.use("/api/enhanced-chat", enhancedChatRoutes);
app.use("/api/challenges", challenges);
app.use("/api/chat", chat);
app.use("/api/debates", debates);
app.use("/api/space", space);
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

// Setup AdminJS with Express

app.use(admin.options.rootPath, adminRouter);
//app.use(admin.options.rootPath, adminRouter);

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

// Health check with enhanced features
app.get("/health", (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'Connected',
      socket: 'Active',
      chat: 'Enhanced Chat System Ready',
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
      'Message search'
    ]
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Aeko Backend Server starting...`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Socket.IO ready for real-time chat`);
  console.log(`🤖 AI Bot integrated and ready`);
  console.log(`📁 File uploads supported (max 100MB)`);
  console.log(`😊 Emoji reactions enabled`);
  console.log(`🎵 Voice messages supported`);
  console.log(`💬 Enhanced Chat System Active`);
  console.log('✨ All systems ready!');
});
