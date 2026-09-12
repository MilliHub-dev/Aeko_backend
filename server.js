import "./config/authStartupValidation.js";
import express from "express";
import os from "os";
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
import { backfillWalletAddresses } from "./services/walletProvisioning.js";
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
import subscriptionPlanRoutes from "./routes/subscriptionPlanRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import profileRoutes from "./routes/profile.js";
import enhancedBotRoutes from "./routes/enhancedBotRoutes.js";
import enhancedChatRoutes from "./routes/enhancedChatRoutes.js";
import enhancedLiveStreamRoutes from "./routes/enhancedLiveStreamRoutes.js";
import interestRoutes from "./routes/interestRoutes.js";
import userInterestRoutes from "./routes/userInterestRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import communityExtendedRoutes from "./routes/communityExtendedRoutes.js";
import communityProfileRoutes from "./routes/communityProfileRoutes.js";
import communityPaymentRoutes from "./routes/communityPaymentRoutes.js";
import securityRoutes from "./routes/security.js";
import exploreRoutes from "./routes/explore.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import nftRoutes from "./routes/nftRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import rewardsRoutes from "./routes/rewardsRoutes.js";
import stakingRoutes from "./routes/stakingRoutes.js";
import coinRoutes from "./routes/coinRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import postTransferRoutes from "./routes/postTransferRoutes.js";

import {
  admin,
  adminRouter,
  adminSessionMiddleware,
  adminSessionVersionGuard,
} from "./admin.js";
import { adminAuth, adminLogin, adminLogout } from "./middleware/adminAuth.js";
import cookieParser from "cookie-parser";
import { sendError } from "./utils/apiErrors.js";
import EnhancedChatSocket from "./sockets/enhancedChatSocket.js";
import EnhancedLiveStreamSocket from "./sockets/enhancedLiveStreamSocket.js";
import setupVideoCallSocket from "./sockets/videoCallSocket.js";
// Import scheduled jobs
import "./jobs/expireSubscriptions.js";
import "./jobs/settleEpoch.js";
import "./jobs/expireStatuses.js";

dotenv.config();
connectDB();

// Configuration
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 9876;

// Production Configuration

const app = express();

// Trust Proxy for Railway/Heroku/Reverse Proxies
app.set("trust proxy", 1);

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8, // 100MB
  transports: ["websocket", "polling"],
});

// Expose the socket server to route handlers (req.app.get("io")).
app.set("io", io);

// Initialize Enhanced Chat Socket System
const enhancedChatSocket = new EnhancedChatSocket(io);

// Initialize Enhanced LiveStream Socket System
const enhancedLiveStreamSocket = new EnhancedLiveStreamSocket(io);

// Initialize Video Call Socket System
setupVideoCallSocket(io);

// Note: File uploads are handled by Cloudinary in production

// CORS and cookie parser (keep these before AdminJS)
app.use(cookieParser());
app.use(
  cors(
    process.env.NODE_ENV === "production"
      ? {
          origin:
            process.env.NODE_ENV === "production"
              ? [
                  process.env.FRONTEND_URL,
                  /\.railway\.app$/,
                  /\.coolify\.io$/,
                  /\.coolify\.[a-z]+$/,
                ]
              : [
                  "http://localhost:3000",
                  "http://localhost:5000",
                  "http://localhost:9876",
                ],
          credentials: true,
        }
      : undefined,
  ),
);

// Static file serving for uploads (disabled in production - using Cloudinary)
if (process.env.NODE_ENV !== "production") {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}

// Mount AdminJS router BEFORE body parsers to avoid WrongArgumentError.
// The outer session + version guard revokes AdminJS sessions after a password change.
app.use(
  admin.options.rootPath,
  adminSessionMiddleware,
  adminSessionVersionGuard,
  adminRouter,
);

// Webhook routes (must be before body parser to handle raw body)
app.use("/api/webhooks", webhookRoutes);

// Body parser middleware (after AdminJS router, before API routes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
// Initialize Passport (OAuth)
app.use(passport.initialize());

// Security rate limiting for sensitive endpoints
const securityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for security endpoints
  message: {
    success: false,
    message: "Too many security requests, please try again later",
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
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Liveness probe: no database, chain or email calls, and deliberately outside
// the rate limiter. Render spins an idle instance down, and the first request
// after that takes tens of seconds — long enough for the app's request
// deadline to abort a login. The app pings this at launch so the instance is
// already awake by the time someone submits a form, and Render can point its
// own health check here to keep the instance warm.
app.get(["/api/health", "/health"], (req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
});

// API Routes with security middleware
app.use("/api/auth", apiRateLimit, authRoutes);
app.use("/api/users", apiRateLimit, userRoutes);
app.use(
  "/api/posts",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  privacyMiddleware.filterResponsePosts,
  postRoutes,
);
app.use(
  "/api/comments",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  commentRoutes,
);
// Story visibility (audience, blocking, muting) is enforced inside
// services/statusService.js. The two middlewares previously mounted here were
// no-ops: checkPostInteraction reads req.params.id, which is empty at mount level,
// and filterResponsePosts only inspects a `posts` key, which this router never returns.
app.use("/api/status", apiRateLimit, statusRoutes);
app.use(
  "/api/debates",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  debateRoutes,
);
app.use(
  "/api/challenges",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  challengeRoutes,
);
app.use(
  "/api/spaces",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  spaceRoutes,
);
app.use(
  "/api/chat",
  apiRateLimit,
  blockingMiddleware.checkMessagingAccess(),
  chatRoutes,
);
app.use("/api/ads", apiRateLimit, adRoutes);
app.use("/api/bot", apiRateLimit, botRoutes);
app.use("/api/interests", apiRateLimit, interestRoutes);
app.use("/api/user/interests", apiRateLimit, userInterestRoutes);
app.use("/api/video", apiRateLimit, videoEditRoutes);
app.use("/api/photo", apiRateLimit, photoEditRoutes);
app.use("/api/payments", apiRateLimit, paymentRoutes);
app.use("/api/profile", apiRateLimit, profileRoutes);
app.use("/api/subscription", apiRateLimit, subscriptionRoutes);
app.use("/api/subscription-plans", apiRateLimit, subscriptionPlanRoutes);
app.use("/api/enhanced-bot", apiRateLimit, enhancedBotRoutes);
app.use(
  "/api/enhanced-chat",
  apiRateLimit,
  blockingMiddleware.checkMessagingAccess(),
  enhancedChatRoutes,
);
// Call history. Calls are stored as chat messages, so this sits with messaging
// and behind the same blocking check.
app.use(
  "/api/calls",
  apiRateLimit,
  blockingMiddleware.checkMessagingAccess(),
  callRoutes,
);
app.use(
  "/api/livestream",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  enhancedLiveStreamRoutes,
);

// Security routes with rate limiting
app.use("/api/security", securityRateLimit, securityRoutes);

// Explore route
app.use(
  "/api/explore",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  privacyMiddleware.filterResponsePosts,
  exploreRoutes,
);
app.use("/api/notifications", apiRateLimit, notificationRoutes);
app.use("/api/reports", apiRateLimit, reportRoutes);
app.use("/api/support", apiRateLimit, supportRoutes);
app.use("/api/waitlist", apiRateLimit, waitlistRoutes);
app.use("/api/wallet", apiRateLimit, walletRoutes);
app.use("/api/nfts", apiRateLimit, nftRoutes);
app.use("/api/marketplace", apiRateLimit, marketplaceRoutes);
app.use("/api/rewards", apiRateLimit, rewardsRoutes);
app.use("/api/staking", apiRateLimit, stakingRoutes);
app.use("/api/coins", apiRateLimit, coinRoutes);
// Unauthenticated presentation config consumed by the mobile client.
app.use("/api/config", apiRateLimit, configRoutes);
// Aggregate user settings (display preferences + notification/privacy/2FA state).
app.use("/api/settings", apiRateLimit, settingsRoutes);
// Post ownership transfer. The router existed but was never mounted, so
// /api/posts/transfer and /api/posts/transfer-history/:id both 404'd.
app.use("/api/posts", apiRateLimit, postTransferRoutes);

// Admin API Routes with 2FA protection for sensitive operations
// Expose admin REST endpoints such as /api/admin/setup/first-admin
app.use("/api/admin", apiRateLimit, adminRoutes);
// If you need separate admin auth endpoints, mount adminAuthRoutes as well
// app.use('/api/admin', adminAuthRoutes);

// Community routes
app.use(
  "/api/communities",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  privacyMiddleware.filterResponsePosts,
  communityRoutes,
);
// Posts, rules, members, moderation, invites, settings and follow. Mounted
// after communityRoutes so the existing create/list/get/join routes win.
app.use(
  "/api/communities",
  apiRateLimit,
  blockingMiddleware.checkPostInteraction(),
  communityExtendedRoutes,
);
app.use(
  "/api/community-profiles",
  apiRateLimit,
  blockingMiddleware.checkProfileAccess(),
  privacyMiddleware.checkProfileAccess,
  communityProfileRoutes,
);
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
  // Classified so infrastructure faults (schema drift, database unreachable)
  // answer 503 with an honest message instead of a blanket 500, and so raw
  // error text never reaches a production client.
  if (res.headersSent) return next(err);
  return sendError(res, err, `${req.method} ${req.originalUrl}`);
});

function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 and skip internal/loopback addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const HOST = "0.0.0.0";

// Start server
server.listen(PORT, HOST, () => {
  const networkIP = getNetworkIP();
  console.log(`🚀 Server is up and running!`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://${networkIP}:${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `AdminJS available at http://localhost:${PORT}${admin.options.rootPath}`,
    );
  }

  // Accounts created before signup assigned a wallet get one now. Delayed so
  // it never competes with boot, and it skips itself without a custody seed.
  setTimeout(() => {
    backfillWalletAddresses().catch((error) =>
      console.error("wallet backfill failed:", error),
    );
  }, 20_000);
});

export default app;
