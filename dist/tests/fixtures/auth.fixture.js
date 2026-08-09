"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockUserDoc = exports.validLoginPayload = exports.validRegistrationPayload = exports.mockUserId = void 0;
// tests/fixtures/auth.fixture.ts
const mongoose_1 = __importDefault(require("mongoose"));
exports.mockUserId = new mongoose_1.default.Types.ObjectId().toString();
exports.validRegistrationPayload = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+94771234567',
    password: 'Password123!',
};
exports.validLoginPayload = {
    email: 'test@example.com',
    password: 'Password123!',
};
exports.mockUserDoc = {
    _id: exports.mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    phone: '+94771234567',
    password: 'hashedpassword',
    role: 'general_user',
    profileCompleted: false,
    roleSelected: false,
    save: jest.fn().mockResolvedValue(true),
};
//# sourceMappingURL=auth.fixture.js.map