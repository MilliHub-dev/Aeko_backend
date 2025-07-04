import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, default: "" },
        media: { type: String, default: "" }, // Image or video URL
        type: { type: String, enum: ["text", "image", "video"], required: true },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who liked the post
        reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who reposted
        originalPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null }, // For reposts
        comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }] // Comments on post
    },
    { timestamps: true }
);

const Post = mongoose.model("Post", PostSchema);
export default Post; // ✅ Correct ES Module export
