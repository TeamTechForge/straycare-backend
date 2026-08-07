"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt = require("bcrypt");
const AdminSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, default: "admin" },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    invitationToken: { type: String, default: null },
    status: { type: String, enum: ["pending", "active"], default: null },
});
AdminSchema.pre("save", async function () {
    if (!this.isModified("password"))
        return;
    this.password = await bcrypt.hash(this.password, 10);
});
module.exports = mongoose_1.default.model("Admin", AdminSchema, "admins");
//# sourceMappingURL=Admin.js.map