"use strict";
// This file defines what a Rescue Request looks like in the database.
// When a user taps "Request Help", a new RescueRequest document is created.
// The status starts as "pending" and changes to "accepted" or "rejected".
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const rescueRequestSchema = new mongoose_1.default.Schema({
    // Which rescuer this request was sent to
    rescuerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Rescuer" },
    // Which user created this request
    userId: { type: String, default: "", index: true },
    caseId: { type: String, default: "" },
    rescueRequestId: { type: String, default: "" },
    animalType: { type: String, default: "Unknown animal" },
    description: { type: String, default: "Pending rescue request" },
    photos: { type: [String], default: [] },
    reporterName: { type: String, default: "Reporter" },
    reporterPhone: { type: String, default: "" },
    reporterAvatar: { type: String, default: "" },
    reporterLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
    },
    rescueLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
    },
    rescuerName: { type: String, default: "" },
    rescuerPhone: { type: String, default: "" },
    rescuerAvatar: { type: String, default: "" },
    distanceKm: { type: Number, default: null },
    etaMinutes: { type: Number, default: null },
    summary: { type: String, default: "Pending rescue request" },
    // Current state of the request
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "completed", "cancelled"], // completed supports finished cases in the new history tabs
        default: "pending",
    },
    // When the request was created
    createdAt: { type: Date, default: Date.now },
});
// Export so rescueController.js can create and query requests
module.exports = mongoose_1.default.model("RescueRequest", rescueRequestSchema);
//# sourceMappingURL=RescueRequest.js.map