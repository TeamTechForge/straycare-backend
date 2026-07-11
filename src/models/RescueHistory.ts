import mongoose from "mongoose";

interface IRescueHistoryLocation {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}

interface IRescueHistory extends mongoose.Document {
  rescueRequestId?: string;
  userId: string;
  caseId: string;
  status: "completed" | "rejected";
  animalType: string;
  description: string;
  photos: string[];
  reporterName: string;
  reporterPhone: string;
  reporterAvatar: string;
  reporterLocation: IRescueHistoryLocation;
  rescuerId: string;
  rescuerName: string;
  rescuerPhone: string;
  rescuerAvatar: string;
  rescuerLocation: IRescueHistoryLocation;
  location: IRescueHistoryLocation;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  summary: string;
  outcome: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const rescueHistorySchema = new mongoose.Schema({
  rescueRequestId: { type: String, index: true },
  userId: { type: String, default: "", index: true },
  caseId: { type: String, default: "" },
  status: {
    type: String,
    enum: ["completed", "rejected"],
    default: "completed",
  },
  animalType: { type: String, default: "Unknown animal" },
  description: { type: String, default: "Rescue case completed" },
  photos: { type: [String], default: [] },
  reporterName: { type: String, default: "Reporter" },

  reporterPhone: { type: String, default: "" },

  reporterAvatar: { type: String, default: "" },
  reporterLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
  },
  rescuerId: { type: String, default: "" },
  rescuerName: { type: String, default: "" },
  rescuerPhone: { type: String, default: "" },
  rescuerAvatar: { type: String, default: "" },
  rescuerLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
  },
  distanceKm: { type: Number, default: null },
  etaMinutes: { type: Number, default: null },
  summary: { type: String, default: "Rescue completed" },
  outcome: { type: String, default: "completed" },
  completedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model<IRescueHistory>("RescueHistory", rescueHistorySchema);
