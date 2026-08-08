"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mockRequestResponse_1 = require("../../helpers/mockRequestResponse");
const callLogController_1 = __importDefault(require("../../../src/controllers/callLogController"));
const callLogService_1 = __importDefault(require("../../../src/services/callLogService"));
const logger_1 = require("../../../src/utils/logger");
jest.mock('../../../src/services/callLogService');
jest.mock('../../../src/utils/logger', () => ({
    Logger: {
        error: jest.fn(),
        info: jest.fn(),
    },
}));
describe('Call Log Controller Unit Tests', () => {
    let req;
    let res;
    beforeEach(() => {
        req = (0, mockRequestResponse_1.mockRequest)();
        res = (0, mockRequestResponse_1.mockResponse)();
        jest.clearAllMocks();
    });
    describe('getHistory', () => {
        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined;
            await callLogController_1.default.getHistory(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
        });
        it('should retrieve call history for the authenticated user', async () => {
            req.user = { id: 'user1' };
            const mockHistory = [{ _id: 'log1', status: 'MISSED' }];
            callLogService_1.default.getHistory.mockResolvedValue(mockHistory);
            await callLogController_1.default.getHistory(req, res);
            expect(callLogService_1.default.getHistory).toHaveBeenCalledWith('user1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockHistory);
        });
        it('should handle errors and return 500', async () => {
            req.user = { id: 'user1' };
            callLogService_1.default.getHistory.mockRejectedValue(new Error('DB Error'));
            await callLogController_1.default.getHistory(req, res);
            expect(logger_1.Logger.error).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
        });
    });
    describe('deleteLog', () => {
        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined;
            req.params = {}; // Prevent Cannot read property 'id' of undefined
            await callLogController_1.default.deleteLog(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
        it('should delete a log successfully and return 200', async () => {
            req.user = { id: 'user1' };
            req.params = { id: 'log1' };
            callLogService_1.default.deleteLog.mockResolvedValue(true);
            await callLogController_1.default.deleteLog(req, res);
            expect(callLogService_1.default.deleteLog).toHaveBeenCalledWith('log1', 'user1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Log deleted successfully' });
        });
        it('should return 404 if log is not found or user unauthorized', async () => {
            req.user = { id: 'user1' };
            req.params = { id: 'log1' };
            callLogService_1.default.deleteLog.mockResolvedValue(false);
            await callLogController_1.default.deleteLog(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Log not found or unauthorized' });
        });
        it('should handle errors and return 500', async () => {
            req.user = { id: 'user1' };
            req.params = { id: 'log1' };
            callLogService_1.default.deleteLog.mockRejectedValue(new Error('DB Error'));
            await callLogController_1.default.deleteLog(req, res);
            expect(logger_1.Logger.error).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
    describe('clearHistory', () => {
        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined;
            await callLogController_1.default.clearHistory(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
        it('should clear all history for the user and return 200', async () => {
            req.user = { id: 'user1' };
            callLogService_1.default.clearHistory.mockResolvedValue(undefined);
            await callLogController_1.default.clearHistory(req, res);
            expect(callLogService_1.default.clearHistory).toHaveBeenCalledWith('user1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'History cleared successfully' });
        });
        it('should handle errors and return 500', async () => {
            req.user = { id: 'user1' };
            callLogService_1.default.clearHistory.mockRejectedValue(new Error('DB Error'));
            await callLogController_1.default.clearHistory(req, res);
            expect(logger_1.Logger.error).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
    describe('markSeen', () => {
        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined;
            await callLogController_1.default.markSeen(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
        it('should mark all missed calls as seen and return 200', async () => {
            req.user = { id: 'user1' };
            callLogService_1.default.markSeen.mockResolvedValue(undefined);
            await callLogController_1.default.markSeen(req, res);
            expect(callLogService_1.default.markSeen).toHaveBeenCalledWith('user1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Marked as seen' });
        });
        it('should handle errors and return 500', async () => {
            req.user = { id: 'user1' };
            callLogService_1.default.markSeen.mockRejectedValue(new Error('DB Error'));
            await callLogController_1.default.markSeen(req, res);
            expect(logger_1.Logger.error).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
//# sourceMappingURL=callLogController.unit.test.js.map