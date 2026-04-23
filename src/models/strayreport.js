const mongoose = require("mongoose");

const StrayReportSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
  },

  animalType: {
    type: String,
    required: true,
  },

  breed: String,

  status: {
    type: String,
    enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption"],
    default: "Needs Help",
  },

  notes: String,

  anonymous: {
    type: Boolean,
    default: false,
  },

  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
  },

  photos: [String],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("StrayReport", StrayReportSchema);
