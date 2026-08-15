import mongoose from "mongoose";

interface INotification extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "welcome";
  read: boolean;
  rescueRequestId?: string;
  caseId?: string;
  event?: string;
  status?: string;
  animalType?: string;
  assignedRescuerName?: string;
  action?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error", "welcome"],
      default: "info",
    },
    read: { type: Boolean, default: false },
    rescueRequestId: { type: String, default: "" },
    caseId: { type: String, default: "" },
    event: { type: String, default: "" },
    status: { type: String, default: "" },
    animalType: { type: String, default: "" },
    assignedRescuerName: { type: String, default: "" },
    action: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model<INotification>("Notification", notificationSchema);
