"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passwordService_1 = require("../../../src/services/passwordService");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
jest.mock('bcryptjs');
describe('PasswordService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('hashPassword', () => {
        it('should hash the password with the default salt rounds (10)', async () => {
            bcryptjs_1.default.hash.mockResolvedValue('hashed-password');
            const result = await passwordService_1.PasswordService.hashPassword('myPassword');
            expect(bcryptjs_1.default.hash).toHaveBeenCalledWith('myPassword', 10);
            expect(result).toBe('hashed-password');
        });
        it('should hash the password with a custom number of salt rounds', async () => {
            bcryptjs_1.default.hash.mockResolvedValue('custom-hashed-password');
            const result = await passwordService_1.PasswordService.hashPassword('myPassword', 12);
            expect(bcryptjs_1.default.hash).toHaveBeenCalledWith('myPassword', 12);
            expect(result).toBe('custom-hashed-password');
        });
    });
    describe('comparePassword', () => {
        it('should return true if passwords match', async () => {
            bcryptjs_1.default.compare.mockResolvedValue(true);
            const result = await passwordService_1.PasswordService.comparePassword('myPassword', 'hashed-password');
            expect(bcryptjs_1.default.compare).toHaveBeenCalledWith('myPassword', 'hashed-password');
            expect(result).toBe(true);
        });
        it('should return false if passwords do not match', async () => {
            bcryptjs_1.default.compare.mockResolvedValue(false);
            const result = await passwordService_1.PasswordService.comparePassword('wrongPassword', 'hashed-password');
            expect(bcryptjs_1.default.compare).toHaveBeenCalledWith('wrongPassword', 'hashed-password');
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=passwordService.unit.test.js.map