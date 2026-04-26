const mongoose = require("mongoose");

const ngoProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    orgName: {
      type: String,
      required: true,
    },
    contactPerson: {
      type: String,
      required: true,
    },
    regNumber: {
      type: String,
      required: true,
    },
    foundedYear: {
      type: String,
    },
    location: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
    },
    profileImage: {
      type: String, // Cloudinary URL (Logo)
    },
    verificationDocument: {
      type: String, // Cloudinary URL
    },
    merchantId: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NGOProfile", ngoProfileSchema);
