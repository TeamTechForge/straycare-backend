"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const OrganizationSchema = new mongoose_1.default.Schema({
    name: String,
    type: String,
    address: String,
    phone: String,
    email: String,
    image: String,
    description: String,
    createdAt: { type: Date, default: Date.now },
}, { collection: "Organizations" });
module.exports = mongoose_1.default.model("Organization", OrganizationSchema);
//# sourceMappingURL=Organization.js.map