const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["general_user", "volunteer", "ngo", "vet", "admin"],
      default: "general_user",
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);