"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const strayReportSchema = new mongoose_1.default.Schema({
    caseId: { type: String, required: true, unique: true },
    animalType: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
        type: String,
        enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption", "Completed"],
        default: "Needs Help",
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String },
    },
    photos: [{ type: String }],
    anonymous: { type: Boolean, default: false },
    reporterUserId: { type: String, default: undefined },
    timeline: [
        {
            status: { type: String },
            message: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    notes: { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose_1.default.models.StrayReport || mongoose_1.default.model("StrayReport", strayReportSchema);
//# sourceMappingURL=StrayReport.js.map