import mongoose from "mongoose";
import { CallStatus } from "../enums/CallStatus.enum";

export interface ICallLog extends mongoose.Document {
  caller: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  status: CallStatus;
  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  duration: number; // in seconds
  isSeen: boolean;
  callerNameOverride?: string;
  receiverNameOverride?: string;
  createdAt: Date;
  updatedAt: Date;
}

const callLogSchema = new mongoose.Schema(
  {
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
      enum: Object.values(CallStatus),
      default: CallStatus.RINGING,
    },
    startedAt: { type: Date },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
    isSeen: { type: Boolean, default: false },
    callerNameOverride: { type: String },
    receiverNameOverride: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.CallLog ||
  mongoose.model<ICallLog>("CallLog", callLogSchema);
