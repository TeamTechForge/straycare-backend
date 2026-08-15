import mongoose, { Document, Schema } from "mongoose";

export interface ICommunityComment extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
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
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

communityCommentSchema.index({ postId: 1, createdAt: 1 });

export default mongoose.models.CommunityComment ||
  mongoose.model<ICommunityComment>("CommunityComment", communityCommentSchema);
