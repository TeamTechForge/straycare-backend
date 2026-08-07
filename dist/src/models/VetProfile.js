"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const VetProfileSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    primaryLocation: { type: String, default: "" },
    bio: { type: String, default: "" },
    clinicName: { type: String, default: "" },
    clinicAddress: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    profileImage: { type: String, default: "" },
    licenseDocument: { type: String, default: "" },
    status: {
        type: String,
        enum: ["Pending", "Verified", "Rejected"],
        default: "Pending",
    },
    accountStatus: { type: String },
    merchantId: { type: String, default: "" },
    merchantSecret: { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose_1.default.model("VetProfile", VetProfileSchema);
//# sourceMappingURL=VetProfile.js.map