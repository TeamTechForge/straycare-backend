import mongoose from "mongoose";

interface IVolunteerProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  location: string;
  bio: string;
  profileImage: string;
  serviceArea?: string;
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
  },
  { timestamps: true }
);

module.exports = mongoose.model<IVolunteerProfile>("VolunteerProfile", VolunteerProfileSchema);
