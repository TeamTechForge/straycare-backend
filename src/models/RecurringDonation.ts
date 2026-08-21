import mongoose from "mongoose";

// A recurring record stores the plan while Donation stores each payment.
const RecurringDonationSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    subscriptionId: { type: String, default: null, index: true },
    donorId: { type: String, required: true, index: true },
    organizationId: { type: String, default: null },
    organization: { type: String, default: "StrayCare" },
    category: { type: String, default: "General" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "LKR" },
    plan: { type: String, required: true },
    recurrence: { type: String, required: true },
    duration: { type: String, default: "Forever" },
    // The status is updated from PayHere notifications and cancellation calls.
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "FAILED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
    },
    installmentsPaid: { type: Number, default: 0 },
    lastPaymentId: { type: String, default: null },
    lastPaymentAt: { type: Date, default: null },
    statusMessage: { type: String, default: "Waiting for PayHere confirmation" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RecurringDonation", RecurringDonationSchema);
