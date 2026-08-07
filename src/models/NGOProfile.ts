import mongoose from "mongoose";

interface INGOProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  orgName: string;
  contactPerson: string;
  regNumber: string;
  foundedYear: string;
  location: string;
  bio: string;
  profileImage: string;
  verificationDocument: string;
  status: "Pending" | "Verified" | "Rejected";
  accountStatus?: string;
  merchantId: string;
  merchantSecret: string;
  totalAdoptions?: number;
  donationCampaignCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const NGOProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    orgName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    regNumber: { type: String, default: "" },
    foundedYear: { type: String, default: "" },
    location: { type: String, default: "" },
    bio: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    verificationDocument: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    accountStatus: { type: String },
    merchantId: { type: String, default: "" },
    merchantSecret: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model<INGOProfile>("NGOProfile", NGOProfileSchema);
