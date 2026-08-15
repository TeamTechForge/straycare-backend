// src/models/Conversation.js
import mongoose from "mongoose";

interface IConversationLastMessage {
  text?: string;
  sender?: mongoose.Types.ObjectId;
  type?: "text" | "image" | "location";
  isEncrypted?: boolean;
  encryptedText?: {
    ciphertext: string;
    iv: string;
    authTag: string;
    version: number;
  };
  createdAt?: Date;
}

interface IRelatedEntity {
  kind?: string;
  item?: mongoose.Types.ObjectId;
  referenceId?: string;
}

interface IConversation extends mongoose.Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage: IConversationLastMessage;
  unreadCounts: Map<string, number>;
  conversationType: "direct" | "rescue" | "adoption" | "community" | "vet_consult" | "lost_found";
  relatedEntity: IRelatedEntity;
  deletedFor: mongoose.Types.ObjectId[];
  clearedAt: Map<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new mongoose.Schema(
  {
    // Exactly 2 participants for 1:1 chat.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Denormalized snapshot of the last message for fast list rendering.
    lastMessage: {
      text: { type: String, default: "" },
      isEncrypted: { type: Boolean, default: false },
      encryptedText: {
        ciphertext: { type: String },
        iv: { type: String },
        authTag: { type: String },
        version: { type: Number },
      },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      type: { type: String, enum: ["text", "image", "location"], default: "text" },
      createdAt: { type: Date },
    },

    // Per-user unread counts: { "<userId>": <count> }
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    // ── Future extensibility ────────────────────────────────────
    // Allows other modules (adoption, community, rescue, vet consult)
    // to attach context to a conversation without changing this schema.
    conversationType: {
      type: String,
      enum: ["direct", "rescue", "adoption", "community", "vet_consult", "lost_found"],
      default: "direct",
    },

    // Generic reference to the entity that spawned this conversation.
    // e.g. a RescueRequest _id, an Adoption post _id, etc.
    relatedEntity: {
      kind: { type: String },           // model name, e.g. "RescueRequest"
      item: { type: mongoose.Schema.Types.ObjectId }, // the document _id
      referenceId: { type: String },    // human-readable ID, e.g. "STRAY-1234"
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    clearedAt: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound index so we can quickly check if a conversation
// between two specific users already exists.
conversationSchema.index({ participants: 1 });

// Fast lookup for listing a user's conversations sorted by activity.
conversationSchema.index({ "lastMessage.createdAt": -1 });

module.exports = mongoose.model<IConversation>("Conversation", conversationSchema);
