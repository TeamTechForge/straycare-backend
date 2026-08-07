"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class PasswordService {
    /**
     * Securely hashes a plaintext password using the bcrypt algorithm.
     *
     * @param password - The plaintext string to hash.
     * @param saltRounds - The computational cost factor for hashing. Defaults to 10.
     * @returns A promise resolving to the bcrypt hash string.
     */
    static async hashPassword(password, saltRounds = 10) {
        return await bcryptjs_1.default.hash(password, saltRounds);
    }
    /**
     * Compares a plaintext password attempt against a stored bcrypt hash.
     *
     * @param password - The plaintext password attempt.
     * @param hash - The previously stored bcrypt hash.
     * @returns A promise resolving to true if they match, false otherwise.
     */
    static async comparePassword(password, hash) {
        return await bcryptjs_1.default.compare(password, hash);
    }
}
exports.PasswordService = PasswordService;
//# sourceMappingURL=PasswordService.js.map