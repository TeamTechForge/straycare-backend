"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const NGOProfileSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    orgName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    regNumber: { type: String, default: "" },
    foundedYear: { type: String, default: "" },
    location: { type: String, default: "" },
    bio: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    verificationDocument: { type: String, default: "" },
    status: {
        type: String,
        enum: ["Pending", "Verified", "Rejected"],
        default: "Pending",
    },
    accountStatus: { type: String },
    merchantId: { type: String, default: "" },
    merchantSecret: { type: String, default: "" },
}, { timestamps: true });
module.exports = mongoose_1.default.model("NGOProfile", NGOProfileSchema);
//# sourceMappingURL=NGOProfile.js.map