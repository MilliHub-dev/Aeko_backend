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
import videoEditRoutes from "./routes/videoEdit.js";
import photoEditRoutes from "./routes/photoEdit.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import swaggerDocs from "./swagger.js";
import passport from "./config/passport.js";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
// import { Database, Resource } from "@adminjs/mongoose"; // REMOVED MONGO
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import profileRoutes from './routes/profile.js';
import enhancedBotRoutes from "./routes/enhancedBotRoutes.js";
import enhancedChatRoutes from "./routes/enhancedChatRoutes.js";
import enhancedLiveStreamRoutes from "./routes/enhancedLiveStreamRoutes.js";
import interestRoutes from "./routes/interestRoutes.js";
import userInterestRoutes from "./routes/userInterestRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import communityProfileRoutes from "./routes/communityProfileRoutes.js";
import communityPaymentRoutes from "./routes/communityPaymentRoutes.js";
import securityRoutes from "./routes/security.js";
import exploreRoutes from "./routes/explore.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";

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
const PORT = process.env.PORT || 9876;

// Production Configuration

const app = express();

// Trust Proxy for Railway/Heroku/Reverse Proxies
app.set('trust proxy', 1);

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8, // 100MB
  transports: ['websocket', 'polling']
});

// Initialize Enhanced Chat Socket System
const enhancedChatSocket = new EnhancedChatSocket(io);

// Initialize Enhanced LiveStream Socket System
const enhancedLiveStreamSocket = new EnhancedLiveStreamSocket(io);

// Note: File uploads are handled by Cloudinary in production

// CORS and cookie parser (keep these before AdminJS)
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, /\.railway\.app$/]
    : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:9876'],
  credentials: true
}));

// Static file serving for uploads (disabled in production - using Cloudinary)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
}

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
app.use("/api/users", apiRateLimit, userRoutes);
app.use("/api/posts", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts, postRoutes);
app.use("/api/comments", apiRateLimit, blockingMiddleware.checkPostInteraction(), commentRoutes);
app.use("/api/status", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts, statusRoutes);
app.use("/api/debates", apiRateLimit, blockingMiddleware.checkPostInteraction(), debateRoutes);
app.use("/api/challenges", apiRateLimit, blockingMiddleware.checkPostInteraction(), challengeRoutes);
app.use("/api/spaces", apiRateLimit, blockingMiddleware.checkPostInteraction(), spaceRoutes);
app.use("/api/chat", apiRateLimit, blockingMiddleware.checkMessagingAccess(), chatRoutes);
app.use('/api/ads', apiRateLimit, adRoutes);
app.use("/api/bot", apiRateLimit, botRoutes);
app.use("/api/interests", apiRateLimit, interestRoutes);
app.use("/api/user/interests", apiRateLimit, userInterestRoutes);
app.use('/api/video', apiRateLimit, videoEditRoutes);
app.use('/api/photo', apiRateLimit, photoEditRoutes);
app.use('/api/payments', apiRateLimit, paymentRoutes);
app.use('/api/profile', apiRateLimit, profileRoutes);
app.use('/api/subscription', apiRateLimit, subscriptionRoutes);
app.use("/api/enhanced-bot", apiRateLimit, enhancedBotRoutes);
app.use("/api/enhanced-chat", apiRateLimit, blockingMiddleware.checkMessagingAccess(), enhancedChatRoutes);
app.use("/api/livestream", apiRateLimit, blockingMiddleware.checkPostInteraction(), enhancedLiveStreamRoutes);

// Security routes with rate limiting
app.use("/api/security", securityRateLimit, securityRoutes);

// Explore route
app.use("/api/explore", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts, exploreRoutes);
app.use("/api/notifications", apiRateLimit, notificationRoutes);
app.use("/api/reports", apiRateLimit, reportRoutes);
app.use('/api/support', apiRateLimit, supportRoutes);

// Admin API Routes with 2FA protection for sensitive operations
// Expose admin REST endpoints such as /api/admin/setup/first-admin
app.use('/api/admin', apiRateLimit, adminRoutes);
// If you need separate admin auth endpoints, mount adminAuthRoutes as well
// app.use('/api/admin', adminAuthRoutes);

// Community routes
app.use("/api/communities", apiRateLimit, blockingMiddleware.checkPostInteraction(), privacyMiddleware.filterResponsePosts, communityRoutes);
app.use("/api/community-profiles", apiRateLimit, blockingMiddleware.checkProfileAccess(), privacyMiddleware.checkProfileAccess, communityProfileRoutes);
app.use("/api/community/payment", apiRateLimit, communityPaymentRoutes); // Added route

swaggerDocs(app);


// Register AdminJS with Mongoose - DISABLED FOR PRISMA MIGRATION
// AdminJS.registerAdapter({ Database, Resource });


// Configure AdminJS - DISABLED FOR PRISMA MIGRATION
/*
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
    }
  ]
};
*/

// Basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
  if (process.env.NODE_ENV !== 'production') {
     console.log(`AdminJS available at http://localhost:${PORT}${admin.options.rootPath}`);
  }
});

export default app;
