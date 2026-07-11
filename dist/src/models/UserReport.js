"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/UserReport.js
const mongoose_1 = __importDefault(require("mongoose"));
const UserReportSchema = new mongoose_1.default.Schema({
    reportedUserId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    reporterUserId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
        minlength: 20,
    },
    status: {
        type: String,
        enum: ["Pending", "Resolved"],
        default: "Pending",
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Virtual field to use _id as reportId
UserReportSchema.virtual("reportId").get(function () {
    return this._id;
});
module.exports = mongoose_1.default.model("UserReport", UserReportSchema);
//# sourceMappingURL=UserReport.js.map