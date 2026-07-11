// models/UserReport.js
import mongoose from "mongoose";

interface IUserReport extends mongoose.Document {
  reportedUserId: mongoose.Types.ObjectId;
  reporterUserId: mongoose.Types.ObjectId;
  reason: string;
  description: string;
  status: "Pending" | "Resolved";
  createdAt: Date;
  updatedAt: Date;
  reportId?: string;
}

const UserReportSchema = new mongoose.Schema(
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
    },
    description: {
      type: String,
      required: true,
      minlength: 20,
    },
    status: {
      type: String,
      enum: ["Pending", "Resolved"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field to use _id as reportId
UserReportSchema.virtual("reportId").get(function (this: IUserReport) {
  return this._id;
});

module.exports = mongoose.model<IUserReport>("UserReport", UserReportSchema);
