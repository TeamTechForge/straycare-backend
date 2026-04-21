const mongoose = require("mongoose");

const forumPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    tag: { type: String, enum: ["GENERAL", "HEALTH"], default: "GENERAL" },
    author: { type: String, default: "You" },
    likes: { type: Number, default: 0 },
    likedByUsers: { type: [String], default: [] },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ForumPost", forumPostSchema);
