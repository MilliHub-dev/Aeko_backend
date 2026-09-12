import AdminJS, { ComponentLoader } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from "@adminjs/prisma";
import express from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { theme as designSystemTheme } from "@adminjs/design-system";
import { prisma } from "./config/db.js";
import { sendExpoPushMessages } from "./services/pushProviderService.js";
import { upgradeStickersForUser } from "./services/stickerUpgrade.js";
import { hasCurrentAuthTokenVersion } from "./utils/authTokenUtils.js";

dotenv.config();

const dmmf = Prisma.dmmf;
const modelMap = dmmf.datamodel.models.reduce((acc, model) => {
  acc[model.name] = model;
  return acc;
}, {});

const buildAdminSessionStore = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return undefined;
  }

  const isLocalDb = /(localhost|127\.0\.0\.1)/i.test(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  });

  const PgSession = connectPgSimple(session);
  return new PgSession({
    pool,
    tableName: "admin_session",
    createTableIfMissing: true,
  });
};

const adminSessionStore = buildAdminSessionStore();
const adminSessionCookieName = "adminjs";
const ADMINJS_COOKIE_SECRET_PLACEHOLDERS = new Set([
  "change-me-in-production",
  "replace_with_a_secure_adminjs_cookie_secret",
  "your_adminjs_cookie_secret",
  "your_adminjs_cookie_secret_here",
  "adminjs_cookie_secret",
  "changeme",
  "default",
  "secret",
  "undefined",
  "null",
]);
const isExampleAdminSessionSecret = (secret) => {
  const normalizedSecret = secret.trim().toLowerCase();
  return (
    ADMINJS_COOKIE_SECRET_PLACEHOLDERS.has(normalizedSecret) ||
    /^<[^>]+>$/.test(normalizedSecret) ||
    /^\[[^\]]+\]$/.test(normalizedSecret)
  );
};
const getAdminSessionCookieSecret = () => {
  const configuredSecret = process.env.ADMINJS_COOKIE_SECRET?.trim();

  if (configuredSecret && !isExampleAdminSessionSecret(configuredSecret)) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMINJS_COOKIE_SECRET must be set to a non-placeholder value in production",
    );
  }

  console.warn(
    "AdminJS is using an ephemeral session secret outside production; existing sessions will not survive a restart.",
  );
  return randomBytes(32).toString("hex");
};
const adminSessionCookieSecret = getAdminSessionCookieSecret();
const adminSessionOptions = {
  resave: false,
  saveUninitialized: true,
  ...(adminSessionStore ? { store: adminSessionStore } : {}),
};

// AdminJS creates its own session middleware. Mounting this equivalent middleware
// before the router lets the version guard run before every AdminJS request; the
// middleware inside AdminJS then reuses req.session instead of loading it twice.
const adminSessionMiddleware = session({
  ...adminSessionOptions,
  secret: adminSessionCookieSecret,
  name: adminSessionCookieName,
});

const toAdminSessionUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  username: user.username,
  isAdmin: Boolean(user.isAdmin),
  authTokenVersion: user.authTokenVersion ?? 0,
});

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '""';
  }

  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const buildWaitlistCsv = (entries) => {
  const header = ["Name", "Email", "Created At"];
  const rows = entries.map((entry) => [
    entry.name,
    entry.email,
    entry.createdAt instanceof Date
      ? entry.createdAt.toISOString()
      : entry.createdAt,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
};

AdminJS.registerAdapter({ Database, Resource });

/**
 * Custom React components for the panel.
 *
 * The files under admin/components/ already existed but nothing ever rendered
 * them: AdminJS 7 will only load a component that has been registered through a
 * ComponentLoader, and there was none — so `dashboard.component` was pinned to
 * `false` and the panel fell back to stock AdminJS throughout.
 *
 * `admin.initialize()` (called for us by buildAuthenticatedRouter) bundles these
 * on boot in production; `admin.watch()` below covers local development.
 */
const currentDir = dirname(fileURLToPath(import.meta.url));
const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add(
    "Dashboard",
    join(currentDir, "admin/components/Dashboard"),
  ),
  PushNotifications: componentLoader.add(
    "PushNotifications",
    join(currentDir, "admin/components/PushNotifications"),
  ),
};

// Replaces the built-in sign-in screen rather than adding a page next to it.
componentLoader.override(
  "Login",
  join(currentDir, "admin/components/Login"),
);

const admin = new AdminJS({
  componentLoader,
  resources: [
    // ===== COMMUNITY MANAGEMENT =====
    {
      resource: { model: modelMap.Community, client: prisma },
      options: {
        parent: {
          name: "Communities",
          icon: "Users",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true },
        },
      },
    },
    {
      resource: { model: modelMap.Transaction, client: prisma },
      options: {
        parent: {
          name: "Monetisation",
          icon: "CreditCard",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
      },
    },
    // ===== STICKER MODERATION =====
    // Stickers are a shared library: anything a user creates appears in every
    // user's picker, so this is the only screen that can take one down.
    // Hiding removes it from the pickers but leaves already-sent messages
    // intact; deleting also removes the image from Cloudinary.
    {
      resource: { model: modelMap.Sticker, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "Smile",
        },
        listProperties: ["url", "name", "creatorId", "isHidden", "createdAt"],
        properties: {
          id: { isVisible: { list: false, show: true, edit: false } },
          url: { isVisible: { list: true, show: true, edit: false } },
          publicId: { isVisible: { list: false, show: true, edit: false } },
          creatorId: { isVisible: { list: true, show: true, edit: false } },
          isHidden: { isVisible: { list: true, show: true, edit: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        actions: {
          // Created by users in the app, never here.
          new: { isVisible: false },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true },
        },
      },
    },
    // ===== INTEREST MANAGEMENT =====
    {
      resource: { model: modelMap.Interest, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "Tag",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true },
        },
        listProperties: ["name", "displayName", "isActive", "createdAt"],
        showProperties: [
          "name",
          "displayName",
          "description",
          "icon",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        editProperties: [
          "name",
          "displayName",
          "description",
          "icon",
          "isActive",
        ],
      },
    },

    // ===== SUPPORT MANAGEMENT =====
    {
      resource: { model: modelMap.SupportTicket, client: prisma },
      options: {
        parent: {
          name: "Support",
          icon: "HelpCircle",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          description: { type: "textarea" },
          status: {
            availableValues: [
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In Progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ],
          },
          priority: {
            availableValues: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
          category: {
            availableValues: [
              { value: "billing", label: "Billing" },
              { value: "technical", label: "Technical" },
              { value: "account", label: "Account" },
              { value: "other", label: "Other" },
            ],
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: [
          "subject",
          "status",
          "priority",
          "category",
          "user",
          "createdAt",
        ],
        showProperties: [
          "subject",
          "description",
          "status",
          "priority",
          "category",
          "user",
          "createdAt",
          "updatedAt",
        ],
        editProperties: ["status", "priority", "category"],
      },
    },
    {
      resource: { model: modelMap.SupportMessage, client: prisma },
      options: {
        parent: {
          name: "Support",
          icon: "MessageSquare",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          message: { type: "textarea" },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ["ticket", "sender", "message", "createdAt"],
        showProperties: [
          "ticket",
          "sender",
          "message",
          "attachments",
          "createdAt",
        ],
        editProperties: ["message"],
      },
    },

    // ===== GROWTH MANAGEMENT =====
    {
      resource: { model: modelMap.WaitlistEntry, client: prisma },
      options: {
        parent: {
          name: "Platform",
          icon: "TrendingUp",
        },
        properties: {
          id: { isVisible: { list: false, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
        },
        actions: {
          new: { isVisible: false },
          edit: { isVisible: false },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true },
          exportCsv: {
            actionType: "resource",
            icon: "Download",
            label: "Export CSV",
            component: false,
            handler: async () => ({
              redirectUrl: `${admin.options.rootPath}/waitlist-export`,
              notice: {
                message: "Preparing waitlist CSV export",
                type: "success",
              },
            }),
          },
        },
        listProperties: ["name", "email", "createdAt"],
        showProperties: ["id", "name", "email", "createdAt"],
      },
    },

    // ===== USER MANAGEMENT =====
    {
      resource: { model: modelMap.User, client: prisma },
      options: {
        parent: {
          name: "Users",
          icon: "Users",
        },
        properties: {
          password: { isVisible: false },
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
          followers: { isVisible: { list: false, show: true, edit: false } },
          following: { isVisible: { list: false, show: true, edit: false } },
          posts: { isVisible: { list: false, show: true, edit: false } },
          botResponses: { isVisible: { list: false, show: true, edit: true } },
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          banUser: {
            actionType: "record",
            icon: "Ban",
            label: "Ban User",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { banned: true },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `User ${record.params.username} has been banned successfully!`,
                  type: "success",
                },
              };
            },
          },
          unbanUser: {
            actionType: "record",
            icon: "Check",
            label: "Unban User",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { banned: false },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `User ${record.params.username} has been unbanned successfully!`,
                  type: "success",
                },
              };
            },
          },
          grantBlueTick: {
            actionType: "record",
            icon: "Award",
            label: "Grant Blue Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { blueTick: true },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Blue tick granted to ${record.params.username}!`,
                  type: "success",
                },
              };
            },
          },
          grantGoldenTick: {
            actionType: "record",
            icon: "Star",
            label: "Grant Golden Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { goldenTick: true },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Golden tick granted to ${record.params.username}!`,
                  type: "success",
                },
              };
            },
          },
          removeBlueTick: {
            actionType: "record",
            icon: "MinusCircle",
            label: "Remove Blue Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { blueTick: false },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Blue tick removed from ${record.params.username}.`,
                  type: "success",
                },
              };
            },
          },
          removeGoldenTick: {
            actionType: "record",
            icon: "MinusCircle",
            label: "Remove Golden Tick",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.user.update({
                where: { id: record.params.id },
                data: { goldenTick: false },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Golden tick removed from ${record.params.username}.`,
                  type: "success",
                },
              };
            },
          },
          activateSubscription: {
            actionType: "record",
            icon: "CreditCard",
            label: "Activate Subscription",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              const oneMonthFromNow = new Date();
              oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
              await prisma.user.update({
                where: { id: record.params.id },
                data: {
                  subscriptionStatus: "active",
                  subscriptionExpiry: oneMonthFromNow,
                },
              });
              // Stickers they made while on the free tier kept their
              // background; now that they are a subscriber, cut them out.
              await upgradeStickersForUser(record.params.id);
              return {
                record: record.toJSON(),
                notice: {
                  message: `Subscription activated for ${record.params.username}!`,
                  type: "success",
                },
              };
            },
          },
          userStats: {
            actionType: "resource",
            icon: "Analytics",
            label: "User Statistics",
            component: false,
            handler: async (request, response, context) => {
              const totalUsers = await prisma.user.count();
              const verifiedUsers = await prisma.user.count({
                where: { OR: [{ blueTick: true }, { goldenTick: true }] },
              });
              const activeSubscriptions = await prisma.user.count({
                where: { subscriptionStatus: "active" },
              });
              const botEnabledUsers = await prisma.user.count({
                where: { botEnabled: true },
              });

              return {
                notice: {
                  message: `Total Users: ${totalUsers}, Verified: ${verifiedUsers}, Active Subscriptions: ${activeSubscriptions}, Bot Enabled: ${botEnabledUsers}`,
                  type: "info",
                },
              };
            },
          },
        },
        listProperties: [
          "username",
          "email",
          "name",
          "blueTick",
          "goldenTick",
          "subscriptionStatus",
          "botEnabled",
          "createdAt",
        ],
        showProperties: [
          "username",
          "email",
          "name",
          "bio",
          "profilePicture",
          "blueTick",
          "goldenTick",
          "subscriptionStatus",
          "subscriptionExpiry",
          "botEnabled",
          "botPersonality",
          "createdAt",
          "updatedAt",
        ],
        editProperties: [
          "name",
          "username",
          "email",
          "bio",
          "profilePicture",
          "blueTick",
          "goldenTick",
          "subscriptionStatus",
          "subscriptionExpiry",
          "botEnabled",
          "botPersonality",
        ],
      },
    },

    // ===== CONTENT MANAGEMENT =====
    {
      resource: { model: modelMap.Post, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "FileText",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
          likes: { isVisible: { list: false, show: true, edit: false } },
          reposts: { isVisible: { list: false, show: true, edit: false } },
          comments: { isVisible: { list: false, show: true, edit: false } },
          users_posts_userIdTouser: {
            isVisible: { list: true, show: true, edit: false },
            label: "User",
          },
        },
        actions: {
          delete: { isVisible: true },
          flagContent: {
            actionType: "record",
            icon: "Flag",
            label: "Flag as Inappropriate",
            component: false,
            handler: async (request, response, context) => {
              // Implementation placeholder
              return {
                record: context.record.toJSON(),
                notice: {
                  message: `Post has been flagged for review!`,
                  type: "warning",
                },
              };
            },
          },
          contentStats: {
            actionType: "resource",
            icon: "BarChart",
            label: "Content Statistics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await prisma.post.groupBy({
                by: ["type"],
                _count: { _all: true },
              });
              const message = stats
                .map((s) => `${s.type}: ${s._count._all} posts`)
                .join(", ");
              return {
                notice: {
                  message: `Content Stats: ${message}`,
                  type: "info",
                },
              };
            },
          },
        },
        listProperties: [
          "users_posts_userIdTouser",
          "type",
          "text",
          "createdAt",
        ],
        showProperties: [
          "users_posts_userIdTouser",
          "text",
          "media",
          "type",
          "likes",
          "reposts",
          "comments",
          "createdAt",
        ],
      },
    },

    {
      resource: { model: modelMap.Comment, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "MessageCircle",
        },
        actions: {
          delete: { isVisible: true },
          moderateComment: {
            actionType: "record",
            icon: "Shield",
            label: "Moderate",
            component: false,
            handler: async (request, response, context) => {
              return {
                record: context.record.toJSON(),
                notice: {
                  message: `Comment moderated successfully!`,
                  type: "success",
                },
              };
            },
          },
        },
      },
    },

    // ===== LIVESTREAM MANAGEMENT =====
    {
      resource: { model: modelMap.LiveStream, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "Video",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          streamKey: { isVisible: { list: false, show: true, edit: false } },
          rtmpUrl: { isVisible: { list: false, show: true, edit: false } },
          hlsUrl: { isVisible: { list: false, show: true, edit: false } },
          webrtcUrl: { isVisible: { list: false, show: true, edit: false } },
          roomId: { isVisible: { list: false, show: true, edit: false } },
          uniqueViewers: {
            isVisible: { list: false, show: true, edit: false },
          },
          reactions: { isVisible: { list: false, show: true, edit: false } },
          currentViewers: {
            isVisible: { list: true, show: true, edit: false },
          },
          peakViewers: { isVisible: { list: true, show: true, edit: false } },
          totalViews: { isVisible: { list: true, show: true, edit: false } },
        },
        actions: {
          delete: { isVisible: true },
          endStream: {
            actionType: "record",
            icon: "StopCircle",
            label: "End Stream",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.liveStream.update({
                where: { id: record.params.id },
                data: {
                  status: "ended",
                  endedAt: new Date(),
                },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Stream "${record.params.title}" has been ended!`,
                  type: "success",
                },
              };
            },
          },
          banStream: {
            actionType: "record",
            icon: "Ban",
            label: "Ban Stream",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.liveStream.update({
                where: { id: record.params.id },
                data: {
                  status: "ended",
                  endedAt: new Date(),
                },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Stream "${record.params.title}" has been banned and ended!`,
                  type: "error",
                },
              };
            },
          },
          streamStats: {
            actionType: "resource",
            icon: "TrendingUp",
            label: "Stream Analytics",
            component: false,
            handler: async (request, response, context) => {
              const stats = await prisma.liveStream.groupBy({
                by: ["status"],
                _count: { _all: true },
                _sum: { totalViews: true },
              });
              const message = stats
                .map(
                  (s) =>
                    `${s.status}: ${s._count._all} streams (${s._sum.totalViews || 0} views)`,
                )
                .join(", ");
              return {
                notice: {
                  message: `Stream Stats: ${message}`,
                  type: "info",
                },
              };
            },
          },
        },
        listProperties: [
          "title",
          "user",
          "status",
          "category",
          "currentViewers",
          "totalViews",
          "createdAt",
        ],
        showProperties: [
          "title",
          "description",
          "user",
          "status",
          "category",
          "currentViewers",
          "peakViewers",
          "totalViews",
          "createdAt",
        ],
        editProperties: ["title", "description", "status", "category"],
      },
    },

    // ===== AI & BOT MANAGEMENT =====
    {
      resource: { model: modelMap.BotSettings, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "Bot",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ["user", "botEnabled", "botPersonality", "aiProvider"],
        showProperties: [
          "user",
          "botEnabled",
          "botPersonality",
          "aiProvider",
          "model",
          "maxTokens",
          "temperature",
          "customInstructions",
        ],
        editProperties: [
          "botEnabled",
          "botPersonality",
          "aiProvider",
          "model",
          "maxTokens",
          "temperature",
          "customInstructions",
        ],
      },
    },

    {
      resource: { model: modelMap.BotConversation, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "MessageSquare",
        },
        listProperties: ["user", "userMessage", "botResponse", "updatedAt"],
        actions: {
          delete: { isVisible: true },
          clearHistory: {
            actionType: "record",
            icon: "Trash",
            label: "Clear Chat History",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.botConversation.update({
                where: { id: record.params.id },
                data: {
                  messages: [],
                  totalMessages: 0,
                },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Chat history cleared for user!`,
                  type: "success",
                },
              };
            },
          },
        },
      },
    },

    // ===== ADVERTISING =====
    {
      resource: { model: modelMap.Ad, client: prisma },
      options: {
        parent: {
          name: "Monetisation",
          icon: "DollarSign",
        },
        actions: {
          approveAd: {
            actionType: "record",
            icon: "Check",
            label: "Approve Ad",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.ad.update({
                where: { id: record.params.id },
                data: { status: "approved" },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Ad "${record.params.title}" has been approved!`,
                  type: "success",
                },
              };
            },
          },
          rejectAd: {
            actionType: "record",
            icon: "X",
            label: "Reject Ad",
            component: false,
            handler: async (request, response, context) => {
              const { record } = context;
              await prisma.ad.update({
                where: { id: record.params.id },
                data: { status: "rejected" },
              });
              return {
                record: record.toJSON(),
                notice: {
                  message: `Ad "${record.params.title}" has been rejected!`,
                  type: "error",
                },
              };
            },
          },
          adStats: {
            actionType: "resource",
            icon: "BarChart3",
            label: "Ad Performance",
            component: false,
            handler: async (request, response, context) => {
              const stats = await prisma.ad.groupBy({
                by: ["status"],
                _count: { _all: true },
              });
              const message = stats
                .map((s) => `${s.status}: ${s._count._all} ads`)
                .join(", ");
              return {
                notice: {
                  message: `Ad Stats: ${message}`,
                  type: "info",
                },
              };
            },
          },
        },
        listProperties: ["title", "mediaType", "Status", "user", "createdAt"],
      },
    },

    // ===== COMMUNITY FEATURES =====
    {
      resource: { model: modelMap.Debate, client: prisma },
      options: {
        parent: {
          name: "Communities",
          icon: "Users2",
        },
      },
    },

    {
      resource: { model: modelMap.Challenge, client: prisma },
      options: {
        parent: {
          name: "Communities",
          icon: "Trophy",
        },
      },
    },

    {
      resource: { model: modelMap.Space, client: prisma },
      options: {
        parent: {
          name: "Communities",
          icon: "Globe",
        },
      },
    },

    // ===== MESSAGING =====
    {
      resource: { model: modelMap.EnhancedMessage, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "Mail",
        },
        properties: {
          attachments: { isVisible: { list: false, show: true, edit: false } },
          metadata: { isVisible: { list: false, show: true, edit: false } },
        },
        listProperties: ["sender", "receiver", "messageType", "createdAt"],
        actions: {
          delete: { isVisible: true },
          flagMessage: {
            actionType: "record",
            icon: "Flag",
            label: "Flag Message",
            component: false,
            handler: async (request, response, context) => {
              return {
                record: context.record.toJSON(),
                notice: {
                  message: `Message has been flagged for review!`,
                  type: "warning",
                },
              };
            },
          },
        },
      },
    },

    {
      resource: { model: modelMap.Chat, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "MessageCircle",
        },
      },
    },

    {
      resource: { model: modelMap.Message, client: prisma },
      options: {
        parent: {
          name: "Messaging",
          icon: "Send",
        },
      },
    },

    // ===== USER ACTIVITY =====
    {
      resource: { model: modelMap.Status, client: prisma },
      options: {
        parent: {
          name: "Content",
          icon: "Activity",
        },
        listProperties: ["users", "content", "createdAt"],
      },
    },

    // ===== NFT RULES =====
    {
      resource: { model: modelMap.NftSettings, client: prisma },
      options: {
        parent: { name: "Platform", icon: "Settings" },
        id: "nft-settings",
        // A single row of platform-wide rules. Creating a second one would make
        // "which settings apply?" ambiguous, so only editing is offered.
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: false },
          bulkDelete: { isVisible: false },
        },
        properties: {
          id: { isVisible: { list: false, show: true, edit: false } },
          engagementThreshold: {
            position: 1,
            description:
              "Engagement points a post needs before its author can mint it as an NFT.",
          },
          likeWeight: {
            position: 2,
            description: "Points awarded per like.",
          },
          commentWeight: {
            position: 3,
            description: "Points per comment — usually higher than a like, since it takes more effort.",
          },
          viewsPerPoint: {
            position: 4,
            description: "Views needed for one point. Higher means views count for less.",
          },
          mintingEnabled: {
            position: 5,
            description: "Turn post-to-NFT conversion on or off for everyone.",
          },
          maxRoyaltyBps: {
            position: 6,
            description: "Highest royalty a creator may set, in basis points (1000 = 10%).",
          },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
          updatedBy: { isVisible: { list: false, show: true, edit: false } },
        },
        listProperties: [
          "engagementThreshold",
          "mintingEnabled",
          "maxRoyaltyBps",
          "updatedAt",
        ],
      },
    },

    // ===== SUBSCRIPTION MANAGEMENT =====
    {
      resource: { model: modelMap.SubscriptionPlan, client: prisma },
      options: {
        parent: {
          name: "Monetisation",
          icon: "Star",
        },
        properties: {
          id: { isVisible: { list: true, show: true, edit: false } },
          features: { type: "textarea" },
          limits: { type: "textarea" },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        actions: {
          new: { isVisible: true },
          edit: { isVisible: true },
          delete: { isVisible: true },
          bulkDelete: { isVisible: true },
        },
        listProperties: [
          "name",
          "price",
          "currency",
          "duration",
          "isActive",
          "createdAt",
        ],
        showProperties: [
          "name",
          "price",
          "currency",
          "duration",
          "features",
          "limits",
          "targetAudience",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        editProperties: [
          "name",
          "price",
          "currency",
          "duration",
          "features",
          "limits",
          "targetAudience",
          "isActive",
        ],
      },
    },
  ],

  // ===== BRANDING & UI CUSTOMIZATION =====
  branding: {
    companyName: "Aeko Admin",
    logo: "/uploads/admin-logo.png",
    softwareBrothers: false,
    favicon: "/uploads/favicon.ico",
    // The previous palette was a generic purple/pink gradient unrelated to the
    // product. These are the app's own tokens (aeko-mobile/constants/Colors.ts),
    // so the panel and the app now read as the same product.
    //
    // Spread over the design system's own theme, NOT passed alone: AdminJS
    // replaces `branding.theme` wholesale rather than deep-merging it. Passing
    // just `{ colors }` left `space`, `fontSizes`, `lineHeights` and `borders`
    // undefined, and every component reading e.g. `theme.space.default` threw
    // "Cannot read properties of undefined (reading 'default')" — the panel
    // died on load with a blank screen.
    theme: {
      ...designSystemTheme,
      colors: {
        ...designSystemTheme.colors,
        primary100: "#00BFA5", // brand teal
        primary80: "#00897B",
        primary60: "#4DD0C4",
        primary40: "#B2DFDB",
        primary20: "#E6F6F4",
        grey100: "#003D3D", // dark teal, used for headings and the sidebar
        grey80: "#2F4F4F",
        grey60: "#5E7A7A",
        grey40: "#9BB0B0",
        grey20: "#D7E2E2",
        filterBg: "#003D3D",
        accent: "#99FF00", // lime, for highlights and active states
        hoverBg: "#E6F6F4",
        bg: "#F7FAFA",
        border: "#DCE7E7",
      },
    },
  },

  // ===== DASHBOARD CUSTOMIZATION =====
  dashboard: {
    component: Components.Dashboard,
    /**
     * Feeds the dashboard. Every figure is counted with `allSettled` so one
     * failing query degrades a single card instead of blanking the whole page —
     * an admin landing page that errors out is worse than one missing a number.
     */
    handler: async (_req, _res, context) => {
      const since = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const week = since(7);

      const queries = {
        users: () => prisma.user.count(),
        usersThisWeek: () =>
          prisma.user.count({ where: { createdAt: { gte: week } } }),
        posts: () => prisma.post.count(),
        postsThisWeek: () =>
          prisma.post.count({ where: { createdAt: { gte: week } } }),
        communities: () => prisma.community.count(),
        liveNow: () =>
          prisma.liveStream.count({ where: { status: "live" } }),
        openReports: () =>
          prisma.report.count({ where: { status: "pending" } }),
        openTickets: () =>
          prisma.supportTicket.count({
            where: { status: { in: ["open", "in_progress"] } },
          }),
        waitlist: () => prisma.waitlistEntry.count(),
        recentUsers: () =>
          prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              name: true,
              username: true,
              profilePicture: true,
              blueTick: true,
              goldenTick: true,
              createdAt: true,
            },
          }),
        // --- Engagement -----------------------------------------------------
        // `Post.likes` is a JSON array with no Like table, so likes are counted
        // in SQL rather than by pulling every post into Node.
        totalLikes: async () => {
          const rows = await prisma.$queryRaw`
            SELECT COALESCE(SUM(jsonb_array_length(
              CASE WHEN jsonb_typeof("likes") = 'array' THEN "likes" ELSE '[]'::jsonb END
            )), 0)::int AS total
            FROM "posts"
          `;
          return Number(rows[0]?.total ?? 0);
        },
        totalViews: async () => {
          const result = await prisma.post.aggregate({ _sum: { views: true } });
          return result._sum.views ?? 0;
        },
        comments: () => prisma.comment.count(),
        commentsThisWeek: () =>
          prisma.comment.count({ where: { createdAt: { gte: week } } }),
        stickers: () => prisma.sticker.count(),
        messagesThisWeek: () =>
          prisma.enhancedMessage.count({ where: { createdAt: { gte: week } } }),

        // --- Monetisation ---------------------------------------------------
        subscribers: () =>
          prisma.user.count({ where: { subscriptionStatus: "active" } }),
        revenue: async () => {
          const result = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { status: "completed" },
          });
          return result._sum.amount ?? 0;
        },
        pushReach: () =>
          prisma.user.count({ where: { pushToken: { not: null } } }),

        // `Community` has no image column — the avatar lives inside the
        // `profile` JSON blob — and `memberCount` is the denormalised counter
        // the app reads, kept alongside the true relation count.
        topCommunities: () =>
          prisma.community.findMany({
            take: 5,
            orderBy: { community_members: { _count: "desc" } },
            select: {
              id: true,
              name: true,
              memberCount: true,
              _count: { select: { community_members: true } },
            },
          }),

        postTrend: async () => {
          // Same 14 buckets as the signup trend, so the two sparklines line up.
          const rows = await prisma.$queryRaw`
            SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
            FROM "posts"
            WHERE "createdAt" >= ${since(14)}
            GROUP BY 1
            ORDER BY 1 ASC
          `;
          return rows.map((r) => ({
            day: r.day.toISOString().slice(0, 10),
            count: Number(r.count),
          }));
        },

        signupTrend: async () => {
          // 14 daily buckets for the sparkline. Grouped in SQL rather than
          // pulling every user row back into Node.
          const rows = await prisma.$queryRaw`
            SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
            FROM "users"
            WHERE "createdAt" >= ${since(14)}
            GROUP BY 1
            ORDER BY 1 ASC
          `;
          return rows.map((r) => ({
            day: r.day.toISOString().slice(0, 10),
            count: Number(r.count),
          }));
        },
      };

      const keys = Object.keys(queries);
      const settled = await Promise.allSettled(
        keys.map((key) => queries[key]()),
      );

      const data = {};
      const failed = [];
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          data[keys[i]] = result.value;
        } else {
          failed.push(keys[i]);
          console.error(`[admin dashboard] ${keys[i]} failed:`, result.reason);
          data[keys[i]] = null;
        }
      });

      return {
        ...data,
        failed,
        adminName: context?.currentAdmin?.name
          ?? context?.currentAdmin?.username
          ?? null,
        generatedAt: new Date().toISOString(),
      };
    },
  },

  // ===== CUSTOM PAGES =====
  //
  // `analytics` and `reports` used to live here with `component: false`, so
  // both appeared in the sidebar and rendered an empty page when clicked.
  // Analytics now lives on the dashboard; reports are a resource.
  pages: {
    pushNotifications: {
      component: Components.PushNotifications,
      icon: "Bell",
      handler: async (request, response, context) => {
        // GET: the audience sizes the composer shows before sending.
        if (request.method !== "post") {
          const [total, reachable, subscribers] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { pushToken: { not: null } } }),
            prisma.user.count({
              where: { subscriptionStatus: "active", pushToken: { not: null } },
            }),
          ]);
          return { audience: { total, reachable, subscribers } };
        }

        const payload = request.payload ?? {};
        const title = String(payload.title ?? "").trim();
        const message = String(payload.message ?? "").trim();
        const target = String(payload.target ?? "all");
        const username = String(payload.username ?? "").trim();

        if (!title || !message) {
          return { error: "A title and a message are both required." };
        }

        // Only users with a token can be reached at all; sending to the rest
        // would inflate the reported count with deliveries that cannot happen.
        let where = { pushToken: { not: null } };
        if (target === "subscribers") {
          where = { ...where, subscriptionStatus: "active" };
        } else if (target === "user") {
          if (!username) return { error: "Enter the username to send to." };
          where = { ...where, username };
        }

        const recipients = await prisma.user.findMany({
          where,
          select: {
            id: true,
            pushToken: true,
            notificationSettings: true,
          },
        });

        if (recipients.length === 0) {
          return {
            error:
              target === "user"
                ? "That user has no device registered for notifications."
                : "Nobody in that audience has notifications enabled yet.",
          };
        }

        // Someone who paused all notifications is recorded in-app but not
        // pushed to, matching sendPushNotification's own behaviour.
        const pushable = recipients.filter(
          (user) => user.notificationSettings?.global?.pauseAll !== true,
        );

        const adminId = context?.currentAdmin?.id ?? null;

        await prisma.notification.createMany({
          data: recipients.map((user) => ({
            recipientId: user.id,
            senderId: adminId,
            type: "ADMIN",
            title,
            message,
            entityType: "SYSTEM",
            metadata: { broadcast: true, target },
          })),
        });

        const { sent, failed } = await sendExpoPushMessages(
          pushable.map((user) => ({
            to: user.pushToken,
            title,
            body: message,
            data: { type: "ADMIN", entityType: "SYSTEM" },
            sound: "default",
            channelId: "default",
          })),
        );

        return {
          result: {
            recorded: recipients.length,
            sent,
            failed,
            paused: recipients.length - pushable.length,
          },
        };
      },
    },
  },

  rootPath: "/admin",

  // Login redirect configuration
  loginPath: "/admin/login",
  logoutPath: "/admin/logout",

  // ===== LOCALE SETTINGS =====
  locale: {
    language: "en",
    availableLanguages: ["en"],
    translations: {
      en: {
        labels: {
          loginWelcome: "Welcome to Aeko Platform Admin",
        },
        actions: {
          banUser: "Ban User",
          unbanUser: "Unban User",
          grantBlueTick: "Grant Blue Tick",
          grantGoldenTick: "Grant Golden Tick",
          activateSubscription: "Activate Subscription",
          userStats: "User Statistics",
          contentStats: "Content Statistics",
          streamStats: "Stream Analytics",
          adStats: "Ad Performance",
          approveAd: "Approve Ad",
          rejectAd: "Reject Ad",
          endStream: "End Stream",
          banStream: "Ban Stream",
          exportCsv: "Export CSV",
          flagContent: "Flag as Inappropriate",
          flagMessage: "Flag Message",
          moderateComment: "Moderate",
          clearHistory: "Clear Chat History",
        },
      },
    },
  },
});

const destroyStaleAdminSession = (req, res) => {
  const redirectToLogin = () => {
    res.clearCookie(adminSessionCookieName);
    res.redirect(admin.options.loginPath);
  };

  if (!req.session) {
    redirectToLogin();
    return;
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Failed to destroy stale AdminJS session", error);
    }
    redirectToLogin();
  });
};

// This is mounted outside AdminJS's router, after its matching session middleware,
// so password resets and changes revoke existing AdminJS sessions immediately.
const adminSessionVersionGuard = async (req, res, next) => {
  const sessionAdmin = req.session?.adminUser;

  if (!sessionAdmin) {
    return next();
  }

  if (typeof sessionAdmin.id !== "string") {
    destroyStaleAdminSession(req, res);
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionAdmin.id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        isAdmin: true,
        authTokenVersion: true,
      },
    });

    if (
      !user ||
      !user.isAdmin ||
      !hasCurrentAuthTokenVersion(sessionAdmin, user)
    ) {
      destroyStaleAdminSession(req, res);
      return;
    }

    // Upgrade legacy sessions and ensure no password/hash or other Prisma fields
    // are retained in the session store.
    req.session.adminUser = toAdminSessionUser(user);
    return next();
  } catch (error) {
    console.error("AdminJS session validation failed", error);
    destroyStaleAdminSession(req, res);
  }
};

// Custom authentication function with error handling
const authenticate = async (email, password) => {
  try {
    console.log("AdminJS Authentication attempt for:", email);

    if (!email || !password) {
      console.log("Missing email or password");
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        password: true,
        isAdmin: true,
        authTokenVersion: true,
      },
    });
    if (!user) {
      console.log("User not found:", email);
      return false;
    }

    if (!user.isAdmin) {
      console.log("User is not admin:", email);
      return false;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log("Invalid password for user:", email);
      return false;
    }

    return toAdminSessionUser(user);
  } catch (error) {
    console.error("AdminJS Authentication Error:", error);
    return false;
  }
};

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate,
    cookieName: adminSessionCookieName,
    cookiePassword: adminSessionCookieSecret,
  },
  null,
  {
    ...adminSessionOptions,
  },
);

adminRouter.get("/waitlist-export", async (req, res) => {
  try {
    if (!req.session?.adminUser) {
      return res.status(401).send("Unauthorized");
    }

    const entries = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
    });

    const csv = buildWaitlistCsv(entries);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="waitlist-${timestamp}.csv"`,
    );
    res.status(200).send(csv);
  } catch (error) {
    console.error("Waitlist CSV export error:", error);
    res.status(500).send("Failed to export waitlist CSV");
  }
});

// In production `buildAuthenticatedRouter` already triggered `admin.initialize()`,
// which bundles the components above. `watch()` is the development equivalent and
// is a no-op when NODE_ENV is production — without it, local edits to the
// dashboard or login page would never reach the browser.
if (process.env.NODE_ENV !== "production") {
  admin.watch().catch((error) => {
    console.error("AdminJS: component watcher failed to start:", error);
  });
}

export { admin, adminRouter, adminSessionMiddleware, adminSessionVersionGuard };
