const mongoose = require("mongoose");

const rescueHistorySchema = new mongoose.Schema({
  rescueId: String,
  rescuerId: String,
  reporterId: String,
  outcome: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("RescueHistory", rescueHistorySchema);
