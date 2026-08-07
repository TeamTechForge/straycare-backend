"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class JwtService {
    /**
     * Generates a securely signed JSON Web Token for stateless authentication.
     *
     * @param payload - The user details or payload to encode inside the token.
     * @param expiresIn - Expiration time (e.g., "7d", "24h", or number in seconds). Defaults to "7d".
     * @returns The signed JWT string.
     * @throws {Error} If the JWT_SECRET environment variable is missing.
     */
    static generateToken(payload, expiresIn = "7d") {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured on the server");
        }
        return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn });
    }
    /**
     * Verifies a JSON Web Token and decodes its payload.
     *
     * @param token - The raw JWT string from the authorization header.
     * @returns The decoded payload object.
     * @throws {Error} If the token is invalid, expired, or JWT_SECRET is missing.
     */
    static verifyToken(token) {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured on the server");
        }
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
}
exports.JwtService = JwtService;
//# sourceMappingURL=JwtService.js.map