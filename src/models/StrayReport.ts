import mongoose from "mongoose";

/**
 * Interface representing a single chronological entry in the timeline of a stray report.
 * Tracks status transitions, rescuer updates, and audit timestamps.
 */
export interface ITimelineEntry {
  /** The status set at this timeline checkpoint (e.g., "Needs Help", "Under Rescue", "Completed") */
  status?: string;
  /** Human-readable progress message or update note */
  message?: string;
  /** MongoDB ObjectId of the User account performing/logging this update */
  rescuerId?: mongoose.Types.ObjectId;
  /** Display name of the rescuer at the time of the update */
  rescuerName?: string;
  /** Role/title of the rescuer (e.g., "Volunteer", "NGO", "Admin") */
  rescuerRole?: string;
  /** Date and time when this timeline event occurred */
  timestamp?: Date;
}

/**
 * Interface representing geographical coordinates and human-readable address of a stray animal report.
 */
export interface IStrayReportLocation {
  /** Latitude coordinate (-90 to 90) */
  lat?: number;
  /** Longitude coordinate (-180 to 180) */
  lng?: number;
  /** Optional street address or landmark description */
  address?: string;
}

/**
 * Mongoose Document interface representing a Stray Animal Report.
 */
export interface IStrayReport extends mongoose.Document {
  /** Unique public case identifier (e.g. CASE-1700000000000-abc1234) */
  caseId: string;
  /** Primary animal classification (e.g., "Dog", "Cat", "Bird") */
  animalType: string;
  /** Specific breed if identified; defaults to empty string if unknown */
  breed: string;
  /** Legacy single category string retained for backwards compatibility */
  category: string;
  /** Multi-select array of 1 to 3 distinct report categories */
  categories: Array<"Injured" | "Abandoned" | "Aggressive">;
  /** Detailed description of the animal's condition, appearance, or emergency status */
  description: string;
  /** Current status of the report lifecycle */
  status: "Needs Help" | "Under Rescue" | "Treated" | "Ready for Adoption" | "Completed" | "Failed";
  /** Geographical location details (latitude, longitude, optional address) */
  location: IStrayReportLocation;
  /** Array of photo URLs or storage paths (max 5 photos) */
  photos: string[];
  /** Flag indicating whether the report was submitted anonymously */
  anonymous: boolean;
  /** User ID of the reporter if logged in when submitting the report */
  reporterUserId?: string;
  /** MongoDB ObjectId referencing the assigned Rescuer profile */
  assignedRescuerId?: mongoose.Types.ObjectId;
  /** Chronological history log of status changes and rescuer updates */
  timeline: ITimelineEntry[];
  /** Internal administrative or rescuer notes (max 500 chars) */
  notes: string;
  /** Mongoose auto-managed document creation timestamp */
  createdAt: Date;
  /** Mongoose auto-managed document last update timestamp */
  updatedAt: Date;
}

/**
 * Mongoose Schema definition for StrayReport documents.
 */
const strayReportSchema = new mongoose.Schema(
  {
    // Unique identifier for external referencing and case tracking
    caseId: { type: String, required: true, unique: true },

    // Animal type (e.g. Dog, Cat); trimmed and length-limited to 50 characters
    animalType: { type: String, required: true, trim: true, maxlength: 50 },

    // Breed description if known; trimmed and capped at 60 characters
    breed: { type: String, default: "", trim: true, maxlength: 60 },

    // Legacy single category field maintained for backward compatibility
    category: { type: String, default: "", trim: true },

    // Categorized report tags (1 to 3 unique values allowed)
    categories: {
      type: [{ type: String, enum: ["Injured", "Abandoned", "Aggressive"] }],
      default: undefined,
      validate: {
        validator: (value?: string[]) =>
          value === undefined ||
          (value.length >= 1 && value.length <= 3 && new Set(value).size === value.length),
        message: "Select between 1 and 3 unique categories",
      },
    },

    // Detailed situation / condition summary
    description: { type: String, default: "" },

    // Case status stage in the rescue workflow
    status: {
      type: String,
      enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption", "Completed", "Failed"],
      default: "Needs Help",
    },

    // Geographical coordinates and street address
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      address: { type: String },
    },

    // Uploaded photo URLs (maximum 5 photos allowed per report)
    photos: {
      type: [{ type: String, trim: true }],
      validate: {
        // Empty legacy reports remain saveable; new submissions are required
        // to provide 1-5 photos by the report controller.
        validator: (value: string[]) => value.length <= 5,
        message: "A report cannot contain more than 5 photos",
      },
    },

    // Reporter privacy setting
    anonymous: { type: Boolean, default: false },

    // ID of the reporting user (if authenticated)
    reporterUserId: { type: String, default: undefined },

    // The rescuer who successfully claimed this case. Source of truth for status-update authorization.
    assignedRescuerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rescuer",
      default: undefined,
      index: true,
    },

    // Audit trail of status changes and rescuer activity
    timeline: [
      {
        status: { type: String },
        message: { type: String },
        rescuerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rescuerName: { type: String },
        rescuerRole: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // Internal administrative notes (up to 500 characters)
    notes: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Compile or retrieve existing Mongoose model for StrayReport
const StrayReport =
  mongoose.models.StrayReport || mongoose.model<IStrayReport>("StrayReport", strayReportSchema);

// Export model directly for CommonJS require compatibility across existing controllers
module.exports = StrayReport;

