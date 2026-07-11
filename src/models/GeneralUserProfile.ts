import mongoose from "mongoose";

interface IGeneralUserProfile extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  location: string;
  bio: string;
  profileImage: string;
  createdAt: Date;
  updatedAt: Date;
}

const GeneralUserProfileSchema = new mongoose.Schema(
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

module.exports = mongoose.model<IGeneralUserProfile>("GeneralUserProfile", GeneralUserProfileSchema);
