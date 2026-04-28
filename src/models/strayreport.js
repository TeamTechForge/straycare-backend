//  Defines the structure of a stray animal report in MongoDB.
const mongoose = require("mongoose");

const StrayReportSchema = new mongoose.Schema({
  
  // Unique Case Identifier
  caseId: {
    type: String,
    required: true,
    unique: true,
  },

  // Animal Information
  animalType: {
    type: String,
    required: true,
  },

  breed: {
    type: String,
    default: "Unknown",
  },

  //Current rescue status
  status: {
    type: String,
    enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption"],
    default: "Needs Help",
  },

  //Additional notes from the reporter
  notes: String,

  //Whether the user chose to report anonymously
  anonymous: {
    type: Boolean,
    default: false,
  },

  //Location of the incident including  latitude, longitude, human-readable address
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
  },

  //Array of photo URLs.Stored as strings (local or cloud URLs)
  photos: [String],

  // Stores the history of status updates. Each entry contains status, message, and timestamp. 
  timeline: [
    {
      status: { type: String },
      message: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],

 // Auto-generated timestamp when the report was created
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Export model
module.exports = mongoose.model("StrayReport", StrayReportSchema);
