"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const notificationSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
        type: String,
        enum: ["info", "success", "warning", "error", "welcome"],
        default: "info",
    },
    read: { type: Boolean, default: false },
    rescueRequestId: { type: String, default: "" },
    caseId: { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose_1.default.model("Notification", notificationSchema);
//# sourceMappingURL=Notification.js.map