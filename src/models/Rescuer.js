// This file defines what a Rescuer looks like in the database.
// Each rescuer has a name, phone number, profile picture link,
// whether they are available, and where they are located.

const mongoose = require("mongoose");

const rescuerSchema = new mongoose.Schema({
  name: { type: String, required: true },     // Rescuer's full name
  phone: { type: String, default: "" },        // Contact phone number
  avatar: { type: String, default: "" },       // URL of their profile picture (optional)
  isAvailable: { type: Boolean, default: true }, // Are they currently free to help?
  location: {
    latitude: { type: Number, required: true },  // GPS latitude
    longitude: { type: Number, required: true },  // GPS longitude
  },
});

// Export so other files can use Rescuer.find(), Rescuer.create(), etc.
module.exports = mongoose.model("Rescuer", rescuerSchema);
