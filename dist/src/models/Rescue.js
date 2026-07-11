"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/Rescue.js
const mongoose_1 = __importDefault(require("mongoose"));
const RescueSchema = new mongoose_1.default.Schema({
    animal: String,
    location: String,
    date: Date,
    status: String,
    reporter: String
});
module.exports = mongoose_1.default.model("Rescue", RescueSchema, "strayreports");
//# sourceMappingURL=Rescue.js.map