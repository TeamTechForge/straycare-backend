"use strict";
// RescueComment model
// Stores comments and replies for rescue cases.
// Top-level comments have parentCommentId = null.
// Replies reference their parent comment via parentCommentId.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const rescueCommentSchema = new mongoose_1.default.Schema({
    // Which rescue case this comment belongs to
    rescueRequestId: { type: String, required: true, index: true },
    // Who wrote this comment
    userId: { type: String, default: "guest-user" },
    userName: { type: String, default: "Anonymous" },
    userAvatar: { type: String, default: "" },
    // Comment text content
    text: { type: String, required: true, trim: true },
    // If this is a reply, reference the parent comment
    parentCommentId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "RescueComment",
        default: null,
    },
    // When the comment was created
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Compound index for fast lookups by rescue + chronological order
rescueCommentSchema.index({ rescueRequestId: 1, createdAt: -1 });
module.exports = mongoose_1.default.model("RescueComment", rescueCommentSchema);
//# sourceMappingURL=RescueComment.js.map