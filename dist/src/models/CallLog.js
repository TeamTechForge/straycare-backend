"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const CallStatus_enum_1 = require("../enums/CallStatus.enum");
const callLogSchema = new mongoose_1.default.Schema({
    caller: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiver: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(CallStatus_enum_1.CallStatus),
        default: CallStatus_enum_1.CallStatus.RINGING,
    },
    startedAt: { type: Date },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
    isSeen: { type: Boolean, default: false },
}, { timestamps: true });
exports.default = mongoose_1.default.model("CallLog", callLogSchema);
//# sourceMappingURL=CallLog.js.map