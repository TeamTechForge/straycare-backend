const mongoose = require("mongoose");

const vetProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    primaryLocation: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      maxLength: 150,
    },
    clinicName: {
      type: String,
      required: true,
    },
    clinicAddress: {
      type: String,
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
    },
    yearsOfExperience: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String, // Cloudinary URL
    },
    licenseDocument: {
      type: String, // Cloudinary URL
    },
    merchantId: {
      type: String,
    },
    merchantSecret: {
      type: String,
    },
    specialization: {
      type: String,
      default: "",
    },
    animalsTreated: {
      type: Number,
      default: 0,
    },
    emergencyAvailability: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VetProfile", vetProfileSchema);
