import mongoose, { Document, Schema } from "mongoose";

export interface ILostFoundPost extends Document {
  userId: mongoose.Types.ObjectId;
  status: "lost" | "found";
  type: "dog" | "cat" | "other";
  customType?: string;
  breed?: string;
  name?: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  date?: string;
  contactName?: string;
  contactNumber?: string;
  imageUrl?: string;
  images?: string[];
  reportCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const LostFoundPostSchema = new Schema<ILostFoundPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["lost", "found"],
      required: true,
    },
    type: {
      type: String,
      enum: ["dog", "cat", "other"],
      default: "dog",
    },
    customType: {
      type: String,
      trim: true,
    },
    breed: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    date: {
      type: String,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    reportCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, collection: "animalposts" }
);

LostFoundPostSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.LostFoundPost ||
  mongoose.model<ILostFoundPost>(
    "LostFoundPost",
    LostFoundPostSchema
  );
