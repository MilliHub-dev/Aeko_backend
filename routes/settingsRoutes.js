import express from "express";
import { prisma } from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

/**
 * Aggregate user settings.
 *
 * The mobile settings store loads everything in one call. Previously it hit
 * GET /api/settings, which did not exist, so the whole settings surface fell
 * back to its in-memory defaults and lost every change on restart.
 *
 * Display preferences (theme, font size, language, region) live in the
 * User.preferences JSON column added by
 * prisma/migrations/20260902120000_add_user_preferences. Notification, privacy
 * and 2FA state continue to live in their own columns and are merely gathered
 * here — this route is a read/write aggregate, not a second source of truth.
 */

/**
 * Derives the device list shown in Login Activity from recorded sign-ins.
 *
 * There is no device table; sign-ins are logged as SecurityEvents carrying the
 * user agent and IP. Grouping successful logins by user agent gives one entry
 * per device, which is what the screen expects — it previously received an
 * empty array and always read "No login activity found".
 */
function classifyUserAgent(ua = "") {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return { type: "tablet", name: "Tablet" };
  if (/iphone|android|mobile|okhttp|expo/.test(s)) {
    if (s.includes("iphone")) return { type: "mobile", name: "iPhone" };
    if (s.includes("android")) return { type: "mobile", name: "Android device" };
    return { type: "mobile", name: "Mobile device" };
  }
  if (/macintosh|mac os/.test(s)) return { type: "desktop", name: "Mac" };
  if (/windows/.test(s)) return { type: "desktop", name: "Windows PC" };
  if (/linux/.test(s)) return { type: "desktop", name: "Linux PC" };
  return { type: "desktop", name: "Unknown device" };
}

async function buildLoginDevices(userId, req) {
  const events = await prisma.securityEvent.findMany({
    where: { userId, eventType: "login", success: true },
    orderBy: { timestamp: "desc" },
    take: 100,
    select: { id: true, userAgent: true, ipAddress: true, timestamp: true },
  });

  const currentUa = req.headers["user-agent"] || "";
  const byAgent = new Map();

  for (const e of events) {
    const key = e.userAgent || "unknown";
    // Events are newest-first, so the first occurrence is the latest sign-in.
    if (byAgent.has(key)) continue;
    const { type, name } = classifyUserAgent(key);
    byAgent.set(key, {
      id: e.id,
      deviceName: name,
      deviceType: type,
      // No geo-IP lookup is wired up; showing the IP is honest, inventing a
      // city is not.
      location: e.ipAddress && e.ipAddress !== "unknown" ? e.ipAddress : "Unknown location",
      lastActive: e.timestamp.toISOString(),
      isCurrentDevice: key === currentUa,
    });
  }

  return [...byAgent.values()];
}

const router = express.Router();

const DEFAULT_PREFERENCES = {
  theme: "system",
  fontSize: "medium",
  language: "English",
  region: "",
};

const DEFAULT_NOTIFICATIONS = {
  pushNotifications: {
    likesAndReactions: true,
    comments: true,
    newFollowers: true,
    mentionsAndTags: true,
    messages: true,
    walletAndUpdates: true,
    securityAlerts: true,
    systemAnnouncements: true,
  },
  emailNotifications: true,
  inAppSound: true,
  quietMode: false,
  priorityOnlyMode: false,
};

const DEFAULT_PRIVACY = {
  isPrivateAccount: false,
  whoCanSeeMyPosts: "everyone",
  blockedUsers: [],
};

/** JSON columns are nullable and untyped; never spread them blind. */
const obj = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const ALLOWED_PREFERENCE_KEYS = ["theme", "fontSize", "language", "region"];
const ALLOWED_THEMES = ["light", "dark", "system"];
const ALLOWED_FONT_SIZES = ["small", "medium", "large"];

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: All of the caller's settings in one payload
 *     security:
 *       - bearerAuth: []
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
        notificationSettings: true,
        privacy: true,
        twoFactorAuth: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const preferences = { ...DEFAULT_PREFERENCES, ...obj(user.preferences) };
    const twoFactor = obj(user.twoFactorAuth);

    res.json({
      ...preferences,
      notifications: { ...DEFAULT_NOTIFICATIONS, ...obj(user.notificationSettings) },
      privacy: { ...DEFAULT_PRIVACY, ...obj(user.privacy) },
      twoFactorAuth: {
        isEnabled: Boolean(twoFactor.isEnabled),
        ...(twoFactor.enabledAt ? { enabledAt: twoFactor.enabledAt } : {}),
      },
      loginDevices: await buildLoginDevices(userId, req),
    });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update display preferences (theme, font size, language, region)
 *     security:
 *       - bearerAuth: []
 */
router.put("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const body = req.body || {};

    // Only display preferences are writable here. Notification, privacy and 2FA
    // settings keep their own validated endpoints.
    const updates = {};
    for (const key of ALLOWED_PREFERENCE_KEYS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (updates.theme && !ALLOWED_THEMES.includes(updates.theme)) {
      return res
        .status(400)
        .json({ error: `theme must be one of: ${ALLOWED_THEMES.join(", ")}` });
    }
    if (updates.fontSize && !ALLOWED_FONT_SIZES.includes(updates.fontSize)) {
      return res
        .status(400)
        .json({ error: `fontSize must be one of: ${ALLOWED_FONT_SIZES.join(", ")}` });
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No supported preference fields supplied" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const preferences = { ...DEFAULT_PREFERENCES, ...obj(user.preferences), ...updates };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences },
    });

    res.json({ success: true, ...preferences });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
