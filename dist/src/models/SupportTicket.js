"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const SupportTicketSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
module.exports = mongoose_1.default.model("SupportTicket", SupportTicketSchema);
//# sourceMappingURL=SupportTicket.js.map