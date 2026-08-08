"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jwtService_1 = require("../../../src/services/jwtService");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
jest.mock('jsonwebtoken');
describe('JwtService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });
    const mockPayload = { id: '6a76295f94f8d7329b65475f', role: 'general_user' };
    describe('generateToken', () => {
        it('should generate an access token with correct payload and options', () => {
            jsonwebtoken_1.default.sign.mockReturnValue('mock-access-token');
            const token = jwtService_1.JwtService.generateToken(mockPayload, '1h');
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalledWith(mockPayload, 'test-secret', { expiresIn: '1h' });
            expect(token).toBe('mock-access-token');
        });
        it('should use default 7d expiration if not provided', () => {
            jsonwebtoken_1.default.sign.mockReturnValue('mock-access-token');
            jwtService_1.JwtService.generateToken(mockPayload);
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalledWith(mockPayload, 'test-secret', { expiresIn: '7d' });
        });
        it('should throw an error if JWT_SECRET is missing', () => {
            delete process.env.JWT_SECRET;
            expect(() => jwtService_1.JwtService.generateToken(mockPayload)).toThrow('JWT_SECRET is not configured on the server');
        });
    });
    describe('verifyToken', () => {
        it('should verify token using JWT_SECRET', () => {
            jsonwebtoken_1.default.verify.mockReturnValue(mockPayload);
            const decoded = jwtService_1.JwtService.verifyToken('mock-access-token');
            expect(jsonwebtoken_1.default.verify).toHaveBeenCalledWith('mock-access-token', 'test-secret');
            expect(decoded).toEqual(mockPayload);
        });
        it('should throw an error if JWT_SECRET is missing during verify', () => {
            delete process.env.JWT_SECRET;
            expect(() => jwtService_1.JwtService.verifyToken('mock-token')).toThrow('JWT_SECRET is not configured on the server');
        });
    });
});
//# sourceMappingURL=jwtService.unit.test.js.map