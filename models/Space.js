import mongoose from "mongoose";

const SpaceSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isLive: { type: Boolean, default: true },
  highlights: [{ videoUrl: String, timestamp: Date }],
  createdAt: { type: Date, default: Date.now },
});

const Space = mongoose.model("Space", SpaceSchema);
export default Space;
