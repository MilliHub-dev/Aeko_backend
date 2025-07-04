import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false }, // Soft delete option
    attachments: [{ type: String }], // Array of URLs for images, videos, etc.
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", MessageSchema);
export default Message;
