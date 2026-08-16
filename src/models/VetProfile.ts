import mongoose from "mongoose";

interface IVetProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  primaryLocation: string;
  bio: string;
  clinicName: string;
  clinicAddress: string;
  licenseNumber: string;
  yearsOfExperience: number;
  profileImage: string;
  licenseDocument: string;
  status: "Pending" | "Verified" | "Rejected";
  accountStatus?: string;
  merchantId: string;
  merchantSecret: string;
  payHereAppId?: string;
  payHereAppSecret?: string;
  specialization?: string;
  animalsTreated?: number;
  emergencyAvailability?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VetProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    primaryLocation: { type: String, default: "" },
    bio: { type: String, default: "" },
    clinicName: { type: String, default: "" },
    clinicAddress: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    profileImage: { type: String, default: "" },
    licenseDocument: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    accountStatus: { type: String },
    merchantId: { type: String, default: "" },
    merchantSecret: { type: String, default: "" },
    payHereAppId: { type: String, default: "", select: false },
    payHereAppSecret: { type: String, default: "", select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model<IVetProfile>("VetProfile", VetProfileSchema);
