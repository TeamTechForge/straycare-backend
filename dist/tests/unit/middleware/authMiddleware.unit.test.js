"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mockRequestResponse_1 = require("../../helpers/mockRequestResponse");
const authMiddleware_1 = __importDefault(require("../../../src/middleware/authMiddleware"));
// Mock jsonwebtoken
jest.mock('jsonwebtoken');
describe('Auth Middleware', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = (0, mockRequestResponse_1.mockRequest)();
        res = (0, mockRequestResponse_1.mockResponse)();
        next = (0, mockRequestResponse_1.mockNext)();
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });
    it('should return 401 if no authorization header is provided', () => {
        req.headers = {};
        (0, authMiddleware_1.default)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
        expect(next).not.toHaveBeenCalled();
    });
    it('should return 401 if authorization header does not start with Bearer', () => {
        req.headers = { authorization: 'Basic some-token' };
        (0, authMiddleware_1.default)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. No token provided.' });
        expect(next).not.toHaveBeenCalled();
    });
    it('should return 401 if token is invalid', () => {
        req.headers = { authorization: 'Bearer invalid-token' };
        jsonwebtoken_1.default.verify.mockImplementation(() => {
            throw new Error('Invalid token');
        });
        (0, authMiddleware_1.default)(req, res, next);
        expect(jsonwebtoken_1.default.verify).toHaveBeenCalledWith('invalid-token', 'test-secret');
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
    });
    it('should call next and set req.user if token is valid', () => {
        req.headers = { authorization: 'Bearer valid-token' };
        const decodedPayload = { id: 'user123', role: 'general_user' };
        jsonwebtoken_1.default.verify.mockReturnValue(decodedPayload);
        (0, authMiddleware_1.default)(req, res, next);
        expect(jsonwebtoken_1.default.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
        expect(req.user).toEqual({ id: 'user123', role: 'general_user' });
        expect(next).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=authMiddleware.unit.test.js.map