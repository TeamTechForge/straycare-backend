import mongoose, { Document, Schema } from "mongoose";

export interface IPost extends Document {
  userId: mongoose.Types.ObjectId;
  category: string;
  customCategory?: string;
  breed: string;
  age: string;
  gender: string;
  name: string;
  status: "Available" | "Pending" | "Adopted";
  healthStatus: "Healthy" | "Needs Care" | "Under Treatment" | "Special Needs";
  description: string;
  traits: string[];
  images: string[];
  location: string;
  posterName: string;
  contact: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    customCategory: { type: String },
    breed: { type: String, required: true },
    age: { type: String, required: true },
    gender: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Available", "Pending", "Adopted"],
      default: "Available",
    },
    healthStatus: {
      type: String,
      enum: ["Healthy", "Needs Care", "Under Treatment", "Special Needs"],
      default: "Healthy",
    },
    description: { type: String, required: true },
    traits: [{ type: String }],
    images: [{ type: String }],
    location: { type: String, required: true },
    posterName: { type: String, required: true },
    contact: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IPost>("Post", PostSchema);