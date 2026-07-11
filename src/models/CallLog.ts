// src/models/CallLog.js
import mongoose from "mongoose";

interface ICallLog extends mongoose.Document {
  conversationId?: mongoose.Types.ObjectId;
  caller: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  status: "ringing" | "answered" | "missed" | "rejected" | "ended";
  startedAt?: Date;
  endedAt?: Date;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

const callLogSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },

    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["ringing", "answered", "missed", "rejected", "ended"],
      default: "ringing",
    },

    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 }, // seconds
  },
  { timestamps: true }
);

module.exports = mongoose.model<ICallLog>("CallLog", callLogSchema);
