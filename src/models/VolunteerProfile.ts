import mongoose from "mongoose";

interface IVolunteerProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  location: string;
  bio: string;
  profileImage: string;
  serviceArea?: string;
  accountStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    location: { type: String, default: "" },
    bio: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    accountStatus: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.VolunteerProfile || mongoose.model<IVolunteerProfile>("VolunteerProfile", VolunteerProfileSchema);
