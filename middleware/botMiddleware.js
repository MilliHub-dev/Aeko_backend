import { prisma } from "../config/db.js";
import { sendError } from "../utils/apiErrors.js";

// Middleware to modify bot's response based on personality
export const botResponseMiddleware = async (req, res, next) => {
  // Try to find any bot settings (legacy behavior seemed to imply singleton)
  // or default to friendly if none found.
  try {
    const botSettings = await prisma.botSettings.findFirst();
    
    if (!botSettings || !botSettings.botEnabled) {
        // If strict mode, we might disable. But legacy code disabled it.
        // If no settings exist, maybe we should allow it with default?
        // Legacy: if (!botSettings || !botSettings.botEnabled) return 403.
        // We will stick to legacy behavior.
        // `code` lets the app tell "you turned it off" from a real fault; it
        // branches on BOT_DISABLED to offer a link to bot settings.
        if (!botSettings) {
          return res.status(403).json({
            success: false,
            code: "BOT_NOT_CONFIGURED",
            message: "The assistant isn't set up on this server yet.",
          });
        }
        if (!botSettings.botEnabled) {
          return res.status(403).json({
            success: false,
            code: "BOT_DISABLED",
            message:
              "Your AI assistant is turned off. Turn it on in Settings → Bot settings.",
          });
        }
    }

    // Inject bot personality into request
    req.botPersonality = botSettings.botPersonality;
    next();
  } catch (error) {
    console.error("Bot middleware error:", error);
    // Was `error` only, which the app cannot show, so every failure here
    // surfaced as a bare "Something went wrong".
    sendError(res, error, "bot middleware");
  }
};
