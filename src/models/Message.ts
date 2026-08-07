// src/models/Message.js
import mongoose from "mongoose";

interface IMessageLocation {
  latitude?: number;
  longitude?: number;
  address?: string;
}

interface IMessage extends mongoose.Document {
  conversationId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text: string;
  type: "text" | "image" | "location";
  imageUrl?: string;
  imagePublicId?: string;
  location?: IMessageLocation;
  readBy: mongoose.Types.ObjectId[];
  deletedFor: mongoose.Types.ObjectId[];
  isDeletedForEveryone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Message content — at least one of text / imageUrl / location should be set.
    text: { type: String, default: "" },

    type: {
      type: String,
      enum: ["text", "image", "location"],
      default: "text",
    },

    // Cloudinary image data (type === "image")
    imageUrl: { type: String },
    imagePublicId: { type: String },

    // Location data (type === "location")
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
    },

    // Array of user IDs who have read this message.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for paginated message queries (newest first).
messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model<IMessage>("Message", messageSchema);
