"use strict";
// This file defines what a Rescuer looks like in the database.
// Each rescuer has a name, phone number, profile picture link,
// whether they are available, and where they are located.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const rescuerSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true }, // Rescuer's full name
    phone: { type: String, default: "" }, // Contact phone number
    avatar: { type: String, default: "" }, // URL of their profile picture (optional)
    isAvailable: { type: Boolean, default: true }, // Are they currently free to help?
    location: {
        latitude: { type: Number, required: true }, // GPS latitude
        longitude: { type: Number, required: true }, // GPS longitude
    },
});
// Export so other files can use Rescuer.find(), Rescuer.create(), etc.
module.exports = mongoose_1.default.model("Rescuer", rescuerSchema);
//# sourceMappingURL=Rescuer.js.map