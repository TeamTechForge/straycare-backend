// This file defines a Forum Thread — the comments section of a post.

import mongoose from "mongoose";

interface IForumComment {
  userId?: string;
  userName?: string;
  text?: string;
  timestamp?: Date;
}

interface IForum extends mongoose.Document {
  rescueId?: string;
  comments: IForumComment[];
}

const forumSchema = new mongoose.Schema({
  rescueId: String, // The ID of the ForumPost this thread belongs to

  // Array of comments — each comment has who wrote it, what they said, and when
  comments: [
    {
      userId: String,                              // Who wrote the comment
      userName: String,                            // Actual username of commenter
      text: String,                                // The comment text
      timestamp: { type: Date, default: Date.now } // When it was posted
    }
  ]
});

// Export so forumController.js can add comments and fetch threads
module.exports = mongoose.model<IForum>("Forum", forumSchema);
