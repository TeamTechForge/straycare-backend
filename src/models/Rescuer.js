const mongoose = require("mongoose");

const rescuerSchema = new mongoose.Schema({
  userId: String,
  name: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]
  },
  available: { type: Boolean, default: true }
});

rescuerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Rescuer", rescuerSchema);
