import mongoose from "mongoose";

const botSettingsSchema = new mongoose.Schema({
  botEnabled: { type: Boolean, default: false },
  botPersonality: { type: String, enum: ["friendly", "professional", "sarcastic"], default: "friendly" },
});

export default mongoose.model("BotSettings", botSettingsSchema);
