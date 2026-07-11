"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Message.js
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
    conversationId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    sender: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Message content — at least one of text / imageUrl / location should be set.
    text: { type: String, default: "" },
    type: {
        type: String,
        enum: ["text", "image", "location"],
        default: "text",
    },
    // Cloudinary image data (type === "image")
    imageUrl: { type: String },
    imagePublicId: { type: String },
    // Location data (type === "location")
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String },
    },
    // Array of user IDs who have read this message.
    readBy: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    deletedFor: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    isDeletedForEveryone: { type: Boolean, default: false },
}, { timestamps: true });
// Compound index for paginated message queries (newest first).
messageSchema.index({ conversationId: 1, createdAt: -1 });
module.exports = mongoose_1.default.model("Message", messageSchema);
//# sourceMappingURL=Message.js.map