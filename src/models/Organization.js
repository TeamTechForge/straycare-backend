const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ["Support Vet Clinic", "Support Shelter"], required: true },
  location: { type: String },
  description: { type: String },
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model("Organization", organizationSchema, "Organizations");
