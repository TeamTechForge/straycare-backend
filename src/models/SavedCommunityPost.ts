import mongoose, { Document, Schema } from "mongoose";

export interface ISavedCommunityPost extends Document {
  userId: mongoose.Types.ObjectId;
  postId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const savedCommunityPostSchema = new Schema<ISavedCommunityPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    postId: { type: Schema.Types.ObjectId, ref: "CommunityPost", required: true, index: true },
  },
  { timestamps: true }
);

// A user can bookmark a post only once; controllers can therefore use idempotent upserts.
savedCommunityPostSchema.index({ userId: 1, postId: 1 }, { unique: true });

export default mongoose.models.SavedCommunityPost ||
  mongoose.model<ISavedCommunityPost>("SavedCommunityPost", savedCommunityPostSchema);
