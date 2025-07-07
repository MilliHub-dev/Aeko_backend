import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";
import EnhancedChatSocket from "./sockets/enhancedChatSocket.js";
import enhancedChatRoutes from "./routes/enhancedChatRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Enhanced Chat Socket System
const enhancedChatSocket = new EnhancedChatSocket(server);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
});

mongoose.connection.on('connected', () => {
  console.log('📊 MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Enhanced Chat Routes
app.use('/api/enhanced-chat', enhancedChatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      socket: 'Active',
      chat: 'Enhanced Chat System Ready'
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

// Chat system info endpoint
app.get('/api/chat-info', (req, res) => {
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
        onlineStatus: true,
        messageEncryption: false // Future feature
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

// Socket.IO connection stats
app.get('/api/socket-stats', (req, res) => {
  res.json({
    success: true,
    socketStats: {
      totalConnections: enhancedChatSocket.io.sockets.sockets.size,
      connectedUsers: enhancedChatSocket.getConnectedUsers().length,
      activeRooms: enhancedChatSocket.io.sockets.adapter.rooms.size,
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'Maximum file size is 100MB'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Invalid file upload',
      message: 'Unexpected file field'
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/enhanced-chat/conversations',
      '/api/enhanced-chat/messages/:chatId',
      '/api/enhanced-chat/send-message',
      '/api/enhanced-chat/upload-voice',
      '/api/enhanced-chat/upload-file',
      '/api/enhanced-chat/emoji-reactions/:messageId',
      '/api/enhanced-chat/bot-chat',
      '/api/enhanced-chat/create-chat',
      '/api/enhanced-chat/mark-read/:chatId',
      '/api/enhanced-chat/search',
      '/api/enhanced-chat/emoji-list',
      '/health',
      '/api/chat-info',
      '/api/socket-stats'
    ]
  });
});

const PORT = process.env.ENHANCED_CHAT_PORT || 5001;

server.listen(PORT, () => {
  console.log('🚀 Enhanced Chat Server starting...');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Socket.IO ready for connections`);
  console.log(`🤖 AI Bot integrated and ready`);
  console.log(`📁 File uploads supported (max 100MB)`);
  console.log(`😊 Emoji reactions enabled`);
  console.log(`🎵 Voice messages supported`);
  console.log(`💬 Real-time chat features active`);
  console.log('✨ Enhanced Chat System Ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

export { app, server, enhancedChatSocket };