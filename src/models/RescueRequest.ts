// This file defines what a Rescue Request looks like in the database.
// When a user taps "Request Help", a new RescueRequest document is created.
// The status starts as "pending" and transitions to "accepted", "rejected", "completed", "failed", or "cancelled".

import mongoose from "mongoose";

/**
 * Geographical coordinates and address payload for rescue request locations.
 */
export interface IRescueRequestLocation {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}

/**
 * Mongoose Document interface representing a Rescue Request dispatched to a rescuer.
 */
export interface IRescueRequest extends mongoose.Document {
  /** Rescuer profile ID to whom this rescue request is assigned */
  rescuerId?: mongoose.Types.ObjectId;
  /** User ID of the user requesting help */
  userId: string;
  /** Public Stray Case ID associated with this rescue request */
  caseId: string;
  /** Unique dispatch identifier for this request */
  rescueRequestId: string;
  /** Animal classification / species */
  animalType: string;
  /** Textual explanation of emergency situation */
  description: string;
  /** Array of photo URLs */
  photos: string[];
  /** Name of the reporting user */
  reporterName: string;
  /** Phone number of the reporting user */
  reporterPhone: string;
  /** Avatar image URL of the reporting user */
  reporterAvatar: string;
  /** Location details of the reporter */
  reporterLocation: IRescueRequestLocation;
  /** Location details where the rescue is required */
  rescueLocation: IRescueRequestLocation;
  /** Name of the assigned rescuer */
  rescuerName: string;
  /** Phone number of the assigned rescuer */
  rescuerPhone: string;
  /** Avatar image URL of the assigned rescuer */
  rescuerAvatar: string;
  /** Calculated distance in kilometers between rescuer and animal */
  distanceKm?: number | null;
  /** Estimated time of arrival in minutes */
  etaMinutes?: number | null;
  /** Brief situation summary */
  summary: string;
  /** Current state of the rescue dispatch request */
  status: "pending" | "accepted" | "rejected" | "completed" | "failed" | "cancelled";
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Mongoose Schema definition for RescueRequest documents.
 */
const rescueRequestSchema = new mongoose.Schema({
  // Which rescuer this request was sent to
  rescuerId: { type: mongoose.Schema.Types.ObjectId, ref: "Rescuer" },

  // Which user created this request
  userId: { type: String, default: "", index: true },

  // Public case ID reference
  caseId: { type: String, default: "" },

  // Dispatch request ID
  rescueRequestId: { type: String, default: "" },

  // Animal type (e.g. Dog, Cat)
  animalType: { type: String, default: "Unknown animal" },

  // Description of animal situation
  description: { type: String, default: "Pending rescue request" },

  // Uploaded photo URLs
  photos: { type: [String], default: [] },

  // Reporter contact details
  reporterName: { type: String, default: "Reporter" },
  reporterPhone: { type: String, default: "" },
  reporterAvatar: { type: String, default: "" },

  // Location of reporter at dispatch time
  reporterLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
  },

  // Location where rescue animal was spotted
  rescueLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" },
  },

  // Rescuer details at assignment time
  rescuerName: { type: String, default: "" },
  rescuerPhone: { type: String, default: "" },
  rescuerAvatar: { type: String, default: "" },

  // Proximity & ETA calculations
  distanceKm: { type: Number, default: null },
  etaMinutes: { type: Number, default: null },

  // Summary text
  summary: { type: String, default: "Pending rescue request" },

  // Current state of the request (terminal statuses support rescue history logs)
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "completed", "failed", "cancelled"],
    default: "pending",
  },

  // When the request was created
  createdAt: { type: Date, default: Date.now },
});

// Compile or retrieve existing Mongoose model for RescueRequest
const RescueRequest =
  mongoose.models.RescueRequest || mongoose.model<IRescueRequest>("RescueRequest", rescueRequestSchema);

// Export model directly for CommonJS require compatibility
module.exports = RescueRequest;
