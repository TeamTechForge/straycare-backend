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
  breed: {
    type: String,
  },
  status: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
  },
  anonymous: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    required: true,
  },
  photos: [
    {
      type: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const StrayReport = mongoose.model("StrayReport", StrayReportSchema);
module.exports = StrayReport;
