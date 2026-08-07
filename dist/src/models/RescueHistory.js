"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const rescueHistorySchema = new mongoose_1.default.Schema({
    rescueRequestId: { type: String, index: true },
    userId: { type: String, default: "", index: true },
    caseId: { type: String, default: "" },
    status: {
        type: String,
        enum: ["completed", "rejected"],
        default: "completed",
    },
    animalType: { type: String, default: "Unknown animal" },
    description: { type: String, default: "Rescue case completed" },
    photos: { type: [String], default: [] },
    reporterName: { type: String, default: "Reporter" },
    reporterPhone: { type: String, default: "" },
    reporterAvatar: { type: String, default: "" },
    reporterLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
    },
    rescuerId: { type: String, default: "" },
    rescuerName: { type: String, default: "" },
    rescuerPhone: { type: String, default: "" },
    rescuerAvatar: { type: String, default: "" },
    rescuerLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
    },
    location: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
    },
    distanceKm: { type: Number, default: null },
    etaMinutes: { type: Number, default: null },
    summary: { type: String, default: "Rescue completed" },
    outcome: { type: String, default: "completed" },
    completedAt: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = mongoose_1.default.model("RescueHistory", rescueHistorySchema);
//# sourceMappingURL=RescueHistory.js.map