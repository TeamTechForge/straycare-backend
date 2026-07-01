const mongoose = require("mongoose");

const rescueRequestSchema = new mongoose.Schema({
  reporterId: String,
  rescuerId: String,
  status: { type: String, default: "pending" }, 
  animalDetails: Object,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]
  },
  rankedRescuerIds: {
    type: [String],
    default: [],
  },
  triedRescuerIds: {
    type: [String],
    default: [],
  },
  broadcasted: {
    type: Boolean,
    default: false,
  },
  assignmentStep: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

rescueRequestSchema.pre("save", function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("RescueRequest", rescueRequestSchema);
