"use strict";
// This file defines a Forum Post — the main post that appears in the discussion list.
// Each post has a title, a tag (GENERAL or HEALTH), who wrote it,
// how many likes it has, and a count of how many comments are in its thread.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const forumPostSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },
    title: { type: String, required: true, trim: true },
    tag: { type: String, enum: ["GENERAL", "HEALTH"], default: "GENERAL" },
    author: { type: String, default: "You" },
    likes: { type: Number, default: 0 },
    likedByUsers: { type: [String], default: [] },
    commentCount: { type: Number, default: 0 },
}, { timestamps: true } // automatically adds createdAt and updatedAt fields
);
// Export so forumController.js can create and query posts
module.exports = mongoose_1.default.model("ForumPost", forumPostSchema);
//# sourceMappingURL=ForumPost.js.map