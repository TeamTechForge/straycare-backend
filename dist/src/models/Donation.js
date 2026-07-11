"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const DonationSchema = new mongoose_1.default.Schema({
    orderId: String,
    amount: Number,
    category: { type: String, default: "General" },
    organization: { type: String, default: "StrayCare" },
    organizationId: { type: String, default: null },
    donorId: { type: String, default: null },
    frequency: { type: String, default: "One-time" },
    plan: { type: String, default: "" },
    status: { type: String, default: "SUCCESS" },
    timestamp: { type: Date, default: Date.now },
});
module.exports = mongoose_1.default.model("Donation", DonationSchema);
//# sourceMappingURL=Donation.js.map