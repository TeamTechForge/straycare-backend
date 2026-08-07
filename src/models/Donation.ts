import mongoose from "mongoose";

interface IDonation extends mongoose.Document {
  orderId: string;
  amount: number;
  category: string;
  organization: string;
  organizationId?: string | null;
  donorId?: string | null;
  frequency: string;
  plan: string;
  status: string;
  timestamp: Date;
}

const DonationSchema = new mongoose.Schema({
  orderId: String,
  amount: Number,
  category: { type: String, default: "General" },
  organization: { type: String, default: "StrayCare" },
  organizationId: { type: String, default: null },
  donorId: { type: String, default: null },
  frequency: { type: String, default: "One-time" },
  plan: { type: String, default: "" },
  status: { type: String, default: "SUCCESS" },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model<IDonation>("Donation", DonationSchema);
