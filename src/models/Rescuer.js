const mongoose = require("mongoose");

const rescuerSchema = new mongoose.Schema({
  userId: String,
  name: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]
  },
  phone: String,
  email: String,
  role: { type: String, default: "rescuer" },
  isAvailable: { type: Boolean, default: true }
});

rescuerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Rescuer", rescuerSchema);
