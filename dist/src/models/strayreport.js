"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const strayReportSchema = new mongoose_1.default.Schema({
    caseId: { type: String, required: true, unique: true },
    animalType: { type: String, required: true, trim: true, maxlength: 50 },
    breed: { type: String, default: "", trim: true, maxlength: 60 },
    category: { type: String, default: "", trim: true },
    categories: {
        type: [{ type: String, enum: ["Injured", "Abandoned", "Aggressive"] }],
        default: undefined,
        validate: {
            validator: (value) => value === undefined ||
                (value.length >= 1 && value.length <= 3 && new Set(value).size === value.length),
            message: "Select between 1 and 3 unique categories",
        },
    },
    description: { type: String, default: "" },
    status: {
        type: String,
        enum: ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption"],
        default: "Needs Help",
    },
    location: {
        lat: { type: Number, required: true, min: -90, max: 90 },
        lng: { type: Number, required: true, min: -180, max: 180 },
        address: { type: String },
    },
    photos: {
        type: [{ type: String, trim: true }],
        validate: {
            // Empty legacy reports remain saveable; new submissions are required
            // to provide 1-5 photos by the report controller.
            validator: (value) => value.length <= 5,
            message: "A report cannot contain more than 5 photos",
        },
    },
    anonymous: { type: Boolean, default: false },
    reporterUserId: { type: String, default: undefined },
    // The rescuer who successfully claimed this case.  This is the source of
    // truth for subsequent status-update authorization.
    assignedRescuerId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Rescuer",
        default: undefined,
        index: true,
    },
    timeline: [
        {
            status: { type: String },
            message: { type: String },
            rescuerId: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "User",
            },
            rescuerName: { type: String },
            rescuerRole: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    notes: { type: String, default: "", trim: true, maxlength: 500 },
}, { timestamps: true });
module.exports = mongoose_1.default.model("StrayReport", strayReportSchema);
//# sourceMappingURL=strayreport.js.map