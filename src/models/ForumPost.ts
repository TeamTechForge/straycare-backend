// This file defines a Forum Post — the main post that appears in the discussion list.
// Each post has a title, a tag (GENERAL or HEALTH), who wrote it,
// how many likes it has, and a count of how many comments are in its thread.

import mongoose from "mongoose";

interface IForumPost extends mongoose.Document {
  userId?: mongoose.Types.ObjectId;
  title: string;
  tag: "GENERAL" | "HEALTH";
  author: string;
  likes: number;
  likedByUsers: string[];
  commentCount: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const forumPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: { type: String, required: true, trim: true },
    tag: { type: String, enum: ["GENERAL", "HEALTH"], default: "GENERAL" },
    author: { type: String, default: "You" },
    likes: { type: Number, default: 0 },
    likedByUsers: { type: [String], default: [] },
    commentCount: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt fields
);

// Export so forumController.js can create and query posts
module.exports = mongoose.model<IForumPost>("ForumPost", forumPostSchema);
