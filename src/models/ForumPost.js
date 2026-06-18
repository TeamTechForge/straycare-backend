// This file defines a Forum Post — the main post that appears in the discussion list.
// Each post has a title, a tag (GENERAL or HEALTH), who wrote it,
// how many likes it has, and a count of how many comments are in its thread.

const mongoose = require("mongoose");

const forumPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true }, // The post's main text
    tag: {
      type: String,
      enum: ["GENERAL", "HEALTH"],   // Post must be tagged as one of these
      default: "GENERAL",
    },
    author: { type: String, default: "You" },             // Name of the person who posted
    likes: { type: Number, default: 0 },                  // Total like count
    likedByUsers: { type: [String], default: [] },        // List of user IDs who liked this post (prevents double-liking)
    commentCount: { type: Number, default: 0 },           // How many comments this post has
  },
  { timestamps: true } // automatically adds createdAt and updatedAt fields
);

// Export so forumController.js can create and query posts
module.exports = mongoose.model("ForumPost", forumPostSchema);
