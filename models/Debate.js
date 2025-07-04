import mongoose from "mongoose";

const DebateSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  scores: { type: Map, of: Number }, // AI Score for each participant
  votes: { type: Map, of: Number }, // User votes for each participant
  createdAt: { type: Date, default: Date.now },
});

const Debate = mongoose.model("Debate", DebateSchema);
export default Debate;
