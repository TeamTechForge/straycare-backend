import mongoose, { Document, Schema } from "mongoose";

export interface CommunityReport {
  reason?: string;
  reportedAt?: Date;
}

export interface ICommunityPost extends Document {
  title: string;
  category: string;
  content: string;
  imageUrl: string | null;
  authorName: string;
  submittedAt: Date;
  reports: CommunityReport[];
  createdAt: Date;
  updatedAt: Date;
}

const communityReportSchema = new Schema<CommunityReport>(
  {
    reason: {
      type: String,
      default: "No reason provided",
      trim: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const communityPostSchema = new Schema<ICommunityPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      default: "Pet Care Tips",
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reports: {
      type: [communityReportSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const CommunityPost = mongoose.model<ICommunityPost>(
  "CommunityPost",
  communityPostSchema
);

export default CommunityPost;
