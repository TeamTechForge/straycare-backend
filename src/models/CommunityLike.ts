import mongoose, { Document, Schema } from "mongoose";

export interface ICommunityLike extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const communityLikeSchema = new Schema<ICommunityLike>(
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
  },
  { timestamps: true }
);

// Enforce one like per user/post pair at the database level.
communityLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export default mongoose.models.CommunityLike ||
  mongoose.model<ICommunityLike>("CommunityLike", communityLikeSchema);
