"use strict";
// This file defines a Forum Thread — the comments section of a post.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const forumSchema = new mongoose_1.default.Schema({
    rescueId: String, // The ID of the ForumPost this thread belongs to
    // Array of comments — each comment has who wrote it, what they said, and when
    comments: [
        {
            userId: String, // Who wrote the comment
            text: String, // The comment text
            timestamp: { type: Date, default: Date.now } // When it was posted
        }
    ]
});
// Export so forumController.js can add comments and fetch threads
module.exports = mongoose_1.default.model("Forum", forumSchema);
//# sourceMappingURL=Forum.js.map