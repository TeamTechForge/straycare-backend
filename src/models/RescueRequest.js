const mongoose = require("mongoose");

const rescueRequestSchema = new mongoose.Schema({
  reporterId: String,
  rescuerId: String,
  status: { type: String, default: "pending" }, 
  animalDetails: Object,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number]
  }
});

module.exports = mongoose.model("RescueRequest", rescueRequestSchema);
