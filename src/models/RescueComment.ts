// RescueComment model
// Stores comments and replies for rescue cases.
// Top-level comments have parentCommentId = null.
// Replies reference their parent comment via parentCommentId.

import mongoose from "mongoose";

interface IRescueComment extends mongoose.Document {
  rescueRequestId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  parentCommentId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const rescueCommentSchema = new mongoose.Schema(
  {
    // Which rescue case this comment belongs to
    rescueRequestId: { type: String, required: true, index: true },

    // Who wrote this comment
    userId: { type: String, default: "guest-user" },
    userName: { type: String, default: "Anonymous" },
    userAvatar: { type: String, default: "" },

    // Comment text content
    text: { type: String, required: true, trim: true },

    // If this is a reply, reference the parent comment
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RescueComment",
      default: null,
    },

    // When the comment was created
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index for fast lookups by rescue + chronological order
rescueCommentSchema.index({ rescueRequestId: 1, createdAt: -1 });

module.exports = mongoose.model<IRescueComment>("RescueComment", rescueCommentSchema);
