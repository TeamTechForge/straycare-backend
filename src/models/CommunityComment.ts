import mongoose, { Document, Schema } from "mongoose";

export interface ICommunityComment extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  parentCommentId?: mongoose.Types.ObjectId | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const communityCommentSchema = new Schema<ICommunityComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // A nullable self-reference represents a top-level comment or one nested reply.
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityComment",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// Supports chronological thread retrieval without an in-memory sort.
communityCommentSchema.index({ postId: 1, createdAt: 1 });

export default mongoose.models.CommunityComment ||
  mongoose.model<ICommunityComment>("CommunityComment", communityCommentSchema);
