const mongoose = require("mongoose");

const volunteerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    location: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      maxLength: 150,
    },
    profileImage: {
      type: String, // Cloudinary URL
    },
    serviceArea: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VolunteerProfile", volunteerProfileSchema);
