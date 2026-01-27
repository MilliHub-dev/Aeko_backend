import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
        if (!botSettings) return res.status(403).json({ message: "Bot settings not configured" });
        if (!botSettings.botEnabled) return res.status(403).json({ message: "Bot is disabled" });
    }

    // Inject bot personality into request
    req.botPersonality = botSettings.botPersonality;
    next();
  } catch (error) {
    console.error("Bot middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
