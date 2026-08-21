import mongoose from "mongoose";

/**
 * Interface representing an In-App Notification document.
 * Used for rescue status updates, community interactions (likes/comments), and system alerts.
 */
export interface INotification extends mongoose.Document {
  /** Target User ID (recipient of the notification) */
  userId: mongoose.Types.ObjectId;
  /** Short headline or notification title */
  title: string;
  /** Main notification body text */
  message: string;
  /** Category type determining presentation style and deduplication behavior */
  type: "info" | "success" | "warning" | "error" | "welcome" | "post_like" | "post_comment";
  /** User ID of the actor initiating the notification (e.g. liker, commenter) */
  actorUserId?: mongoose.Types.ObjectId;
  /** Linked Community Post ID (if notification is related to a post) */
  postId?: mongoose.Types.ObjectId;
  /** Linked Community Comment ID (if notification is related to a comment) */
  commentId?: mongoose.Types.ObjectId;
  /** Whether the notification has been marked as read by the user */
  read: boolean;
  /** Rescue Request ID associated with the notification alert */
  rescueRequestId?: string;
  /** Public Stray Case ID associated with the notification alert */
  caseId?: string;
  /** Specific rescue lifecycle event name (e.g. "rescue_accepted", "status_updated") */
  event?: string;
  /** Status payload associated with the case update */
  status?: string;
  /** Type/species of animal involved in the rescue case */
  animalType?: string;
  /** Display name of the rescuer assigned to the case */
  assignedRescuerName?: string;
  /** Action route identifier for mobile deep-linking (e.g. "view_case") */
  action?: string;
  /** Auto-generated document creation timestamp */
  createdAt: Date;
  /** Auto-generated document last update timestamp */
  updatedAt: Date;
}

/**
 * Mongoose Schema definition for In-App Notifications.
 */
const notificationSchema = new mongoose.Schema(
  {
    // Target user (recipient) receiving the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Notification headline text
    title: { type: String, required: true },
    // Notification message body text
    message: { type: String, required: true },
    // Category type classification
    type: {
      type: String,
      enum: ["info", "success", "warning", "error", "welcome", "post_like", "post_comment"],
      default: "info",
    },
    // Read status indicator
    read: { type: Boolean, default: false },

    // ── Rescue Case Metadata ─────────────────────────────────────
    rescueRequestId: { type: String, default: "" },
    caseId: { type: String, default: "" },
    event: { type: String, default: "" },
    status: { type: String, default: "" },
    animalType: { type: String, default: "" },
    assignedRescuerName: { type: String, default: "" },
    action: { type: String, default: "" },

    // ── Social & Community References ───────────────────────────
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityComment" },
  },
  { timestamps: true }
);

// Prevent duplicate notifications when a user likes the same post multiple times
notificationSchema.index(
  { userId: 1, actorUserId: 1, type: 1, postId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "post_like" },
  }
);

// Prevent duplicate notifications per unique comment
notificationSchema.index(
  { type: 1, commentId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "post_comment" },
  }
);

// Compile or retrieve existing Mongoose model for Notification
const Notification =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", notificationSchema);

// Export model directly for CommonJS require compatibility across services
module.exports = Notification;

