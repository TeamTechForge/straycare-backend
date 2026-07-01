// models/Rescue.js
const mongoose = require("mongoose");

const RescueSchema = new mongoose.Schema({
  animal: String,
  location: String,
  date: Date,
  status: String,
  reporter: String
});

module.exports = mongoose.model("Rescue", RescueSchema, "strayreports");
