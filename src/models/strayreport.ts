import mongoose from "mongoose";

interface ITimelineEntry {
  status?: string;
  message?: string;
  timestamp?: Date;
}

interface IStrayReportLocation {
  lat?: number;
  lng?: number;
  address?: string;
}

interface IStrayReport extends mongoose.Document {
  caseId: string;
  animalType: string;
  description: string;
  status: "Needs Help" | "Under Rescue" | "Treated" | "Ready for Adoption" | "Completed";
  location: IStrayReportLocation;
  photos: string[];
  anonymous: boolean;
  reporterUserId?: string;
  timeline: ITimelineEntry[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const strayReportSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true },
    animalType: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption", "Completed"],
      default: "Needs Help",
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    photos: [{ type: String }],
    anonymous: { type: Boolean, default: false },
    reporterUserId: { type: String, default: undefined },
    timeline: [
      {
        status: { type: String },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model<IStrayReport>("StrayReport", strayReportSchema);
