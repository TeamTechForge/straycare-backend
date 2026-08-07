// models/Rescue.js
import mongoose from "mongoose";

interface IRescue extends mongoose.Document {
  animal?: string;
  location?: string;
  date?: Date;
  status?: string;
  reporter?: string;
}

const RescueSchema = new mongoose.Schema({
  animal: String,
  location: String,
  date: Date,
  status: String,
  reporter: String
});

module.exports = mongoose.model<IRescue>("Rescue", RescueSchema, "strayreports");
