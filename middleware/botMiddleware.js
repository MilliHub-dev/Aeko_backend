import BotSettings from "../models/BotSettings.js";

// Middleware to modify bot's response based on personality
export const botResponseMiddleware = async (req, res, next) => {
  const botSettings = await BotSettings.findOne();
  
  if (!botSettings || !botSettings.botEnabled) {
    return res.status(403).json({ message: "Bot is disabled" });
  }

  // Inject bot personality into request
  req.botPersonality = botSettings.botPersonality;
  next();
};
