"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: function () {
            return this.authProvider !== "google";
        },
    },
    password: {
        type: String,
        required: function () {
            return this.authProvider !== "google";
        },
    },
    role: {
        type: String,
        enum: ["general_user", "volunteer", "ngo", "vet", "admin"],
        default: "general_user",
    },
    authProvider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
    },
    googleId: {
        type: String,
        sparse: true,
    },
    avatar: {
        type: String,
    },
    profileCompleted: {
        type: Boolean,
        default: false,
    },
    roleSelected: {
        type: Boolean,
        default: false,
    },
    isApproved: {
        type: Boolean,
        default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    // ── Chat & Call privacy ─────────────────────────────────────
    // Controls who can initiate a message or voice call with this user.
    // "everyone"     — any authenticated user
    // "contacts"     — only users they've chatted with before
    // "relatedOnly"  — only users with a shared rescue/adoption/consult
    // "none"         — nobody (messages/calls blocked)
    messagingPrivacy: {
        type: String,
        enum: ["everyone", "contacts", "relatedOnly", "none"],
        default: "everyone",
    },
    callingPrivacy: {
        type: String,
        enum: ["everyone", "contacts", "relatedOnly", "none"],
        default: "contacts",
    },
    profileImage: {
        type: String,
        default: "",
    },
    pushToken: {
        type: String,
    },
    accountStatus: {
        type: String,
        default: null,
    },
    blockedUsers: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
}, {
    timestamps: true,
});
const User = mongoose_1.default.models.User || mongoose_1.default.model("User", userSchema);
module.exports = User;
//# sourceMappingURL=User.js.map