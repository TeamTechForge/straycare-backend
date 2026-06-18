// This file defines a Forum Thread — the comments section of a post.

const mongoose = require("mongoose");

const forumSchema = new mongoose.Schema({
  rescueId: String, // The ID of the ForumPost this thread belongs to

  // Array of comments — each comment has who wrote it, what they said, and when
  comments: [
    {
      userId: String,                              // Who wrote the comment
      text: String,                                // The comment text
      timestamp: { type: Date, default: Date.now } // When it was posted
    }
  ]
});

// Export so forumController.js can add comments and fetch threads
module.exports = mongoose.model("Forum", forumSchema);
