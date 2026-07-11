"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/CallLog.js
const mongoose_1 = __importDefault(require("mongoose"));
const callLogSchema = new mongoose_1.default.Schema({
    conversationId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Conversation",
    },
    caller: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiver: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: ["ringing", "answered", "missed", "rejected", "ended"],
        default: "ringing",
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 }, // seconds
}, { timestamps: true });
module.exports = mongoose_1.default.model("CallLog", callLogSchema);
//# sourceMappingURL=CallLog.js.map