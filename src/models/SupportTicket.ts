import mongoose from "mongoose";

interface ISupportTicket extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  category: string;
  subject: string;
  message: string;
  status: "Pending" | "In Progress" | "Resolved" | "Closed";
  adminReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["Bug Report", "Account Issue", "Feature Request", "Technical Support", "General Inquiry"],
      default: "General Inquiry",
    },
    subject: {
      type: String,
      required: true,
      minlength: [5, "Subject must be at least 5 characters long"],
      maxlength: [100, "Subject cannot exceed 100 characters"],
    },
    message: {
      type: String,
      required: true,
      minlength: [10, "Message must be at least 10 characters long"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Closed"],
      default: "Pending",
    },
    adminReply: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
