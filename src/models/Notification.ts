import mongoose from "mongoose";

interface INotification extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "welcome" | "post_like" | "post_comment";
  actorUserId?: mongoose.Types.ObjectId;
  postId?: mongoose.Types.ObjectId;
  commentId?: mongoose.Types.ObjectId;
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
      enum: ["info", "success", "warning", "error", "welcome", "post_like", "post_comment"],
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
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityComment" },
  },
  { timestamps: true }
);

notificationSchema.index(
  { userId: 1, actorUserId: 1, type: 1, postId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "post_like" },
  }
);

notificationSchema.index(
  { type: 1, commentId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "post_comment" },
  }
);

module.exports = mongoose.models.Notification || mongoose.model<INotification>("Notification", notificationSchema);
