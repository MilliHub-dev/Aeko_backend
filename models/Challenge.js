import mongoose from "mongoose";

const ChallengeSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  videoUrl: { type: String, required: true },
  participants: [{ user: mongoose.Schema.Types.ObjectId, videoUrl: String }],
  createdAt: { type: Date, default: Date.now },
});

const Challenge = mongoose.model("Challenge", ChallengeSchema);
export default Challenge;
