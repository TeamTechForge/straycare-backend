const mongoose = require("mongoose");

//Defines the donation schema

const donationSchema = new mongoose.Schema({
  orderId: String,
  donorId: String,
  organizationId: String,
  category: String,       // e.g. Support Shelter, Vet Clinic
  organization: String,   // e.g. Hope Animal Shelter
  frequency: String,      // One-time / Recurring
  plan: String,           // Monthly / Yearly (if recurring)
  amount: Number,
  paymentId: String,
  status: String,         // SUCCESS / FAILED
  timestamp: { type: Date, default: Date.now }
});
//Creates a Mongoose model called Donation
module.exports = mongoose.model("Donation", donationSchema);
