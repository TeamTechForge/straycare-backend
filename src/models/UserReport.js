const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema(
  {
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Spam",
        "Harassment",
        "Fake Information",
        "Animal Abuse Content",
        "Scam / Fraud",
        "Inappropriate Content",
        "Other",
      ],
    },
    description: {
      type: String,
      required: true,
      minlength: 20,
    },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Under Review", "Resolved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// Virtual field for reportId mapping to _id
userReportSchema.virtual("reportId").get(function () {
  return this._id.toHexString();
});
userReportSchema.set("toJSON", { virtuals: true });
userReportSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("UserReport", userReportSchema);
