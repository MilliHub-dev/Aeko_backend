import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    isGroup: { type: Boolean, default: false }, // Flag for group chats
    groupName: { type: String, default: null }, // Name for group chats
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, // Reference to last message
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", ChatSchema);
export default Chat;
