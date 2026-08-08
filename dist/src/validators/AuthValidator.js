"use strict";
// src/validators/AuthValidator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidator = void 0;
class AuthValidator {
    /**
     * Validates the core fields required for registration.
     */
    static validateRegistrationPayload(payload) {
        const { name, email, phone, password } = payload;
        if (!name || !email || !phone || !password) {
            return { isValid: false, message: "All fields are required" };
        }
        if (password.length < 6) {
            return { isValid: false, message: "Password must be at least 6 characters long" };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { isValid: false, message: "Invalid email format" };
        }
        return { isValid: true };
    }
}
exports.AuthValidator = AuthValidator;
//# sourceMappingURL=AuthValidator.js.map