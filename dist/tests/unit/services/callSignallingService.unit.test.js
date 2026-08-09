"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const callSignallingService_1 = __importDefault(require("../../../src/services/callSignallingService"));
const callLogService_1 = __importDefault(require("../../../src/services/callLogService"));
const privacyService_1 = __importDefault(require("../../../src/services/privacyService"));
const CallEvents_1 = require("../../../src/enums/CallEvents");
const CallStatus_enum_1 = require("../../../src/enums/CallStatus.enum");
jest.mock('../../../src/services/callLogService');
jest.mock('../../../src/services/privacyService');
jest.mock('../../../src/utils/logger', () => ({
    Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
describe('Call Signalling Service Unit Tests', () => {
    let mockIo;
    let mockSocketTo;
    let mockSocketEmit;
    beforeEach(() => {
        mockSocketEmit = jest.fn();
        mockSocketTo = jest.fn().mockReturnValue({ emit: mockSocketEmit });
        mockIo = {
            of: jest.fn().mockReturnValue({
                to: mockSocketTo,
            })
        };
        // Ensure all mocked async functions return a promise to prevent .catch() undefined errors
        callLogService_1.default.createLog.mockResolvedValue(undefined);
        callLogService_1.default.markAnswered.mockResolvedValue(undefined);
        callLogService_1.default.markRejected.mockResolvedValue(undefined);
        callLogService_1.default.completeCall.mockResolvedValue(undefined);
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.clearAllTimers();
    });
    describe('handleCallStart', () => {
        const payload = { caller: { userId: 'user1', name: 'User 1' }, calleeId: 'user2' };
        it('should emit BUSY if callee has an active call', async () => {
            callLogService_1.default.findActiveCall.mockResolvedValue({ _id: 'active1' });
            await callSignallingService_1.default.handleCallStart(mockIo, payload);
            expect(callLogService_1.default.findActiveCall).toHaveBeenCalledWith('user2');
            expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.BUSY, payload);
            expect(callLogService_1.default.createLog).toHaveBeenCalledWith('user1', 'user2', CallStatus_enum_1.CallStatus.BUSY);
        });
        it('should emit UNAUTHORIZED if privacy blocks the call', async () => {
            callLogService_1.default.findActiveCall.mockResolvedValue(null);
            privacyService_1.default.canCall.mockResolvedValue({ allowed: false, reason: 'Blocked' });
            await callSignallingService_1.default.handleCallStart(mockIo, payload);
            expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.UNAUTHORIZED, payload);
        });
        it('should emit INCOMING to callee and start ring timeout if allowed', async () => {
            callLogService_1.default.findActiveCall.mockResolvedValue(null);
            privacyService_1.default.canCall.mockResolvedValue({ allowed: true });
            await callSignallingService_1.default.handleCallStart(mockIo, payload);
            expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.INCOMING, payload);
            expect(callLogService_1.default.createLog).toHaveBeenCalledWith('user1', 'user2');
            // Fast forward 30 seconds to trigger timeout
            jest.advanceTimersByTime(30000);
            // Verify timeout behavior
            expect(callLogService_1.default.completeCall).toHaveBeenCalledWith('user1', 'user2');
            expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
            expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.ENDED, { callerId: 'user1', calleeId: 'user2' });
        });
    });
    describe('handleCallAccept', () => {
        it('should emit ACCEPTED to caller and mark call answered', () => {
            const payload = { callerId: 'user1', calleeId: 'user2' };
            callSignallingService_1.default.handleCallAccept(mockIo, payload);
            expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.ACCEPTED, payload);
            expect(callLogService_1.default.markAnswered).toHaveBeenCalledWith('user1', 'user2');
        });
    });
    describe('handleCallDecline', () => {
        it('should emit DECLINED to caller and mark call rejected', () => {
            const payload = { callerId: 'user1', calleeId: 'user2' };
            callSignallingService_1.default.handleCallDecline(mockIo, payload);
            expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.DECLINED, payload);
            expect(callLogService_1.default.markRejected).toHaveBeenCalledWith('user1', 'user2');
        });
    });
    describe('handleCallEnd', () => {
        it('should emit ENDED to the other participant and complete the call log', () => {
            const payload = { callerId: 'user1', calleeId: 'user2' };
            // User1 ends the call, should notify User2
            callSignallingService_1.default.handleCallEnd(mockIo, payload, 'user1');
            expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.ENDED, payload);
            expect(callLogService_1.default.completeCall).toHaveBeenCalledWith('user1', 'user2');
        });
    });
    describe('WebRTC Security (verifyActiveSession)', () => {
        const payload = { callerId: 'user1', calleeId: 'user2', offer: {} };
        it('should block WebRTC Offer if no active session exists', async () => {
            callLogService_1.default.findActiveCall.mockResolvedValue(null);
            await callSignallingService_1.default.handleCallOffer(mockIo, payload);
            // Should not emit
            expect(mockSocketTo).not.toHaveBeenCalled();
        });
        it('should emit WebRTC Offer if active session exists between the two users', async () => {
            // Mock an active call between user1 and user2
            callLogService_1.default.findActiveCall.mockResolvedValue({
                caller: { toString: () => 'user1' },
                receiver: { toString: () => 'user2' }
            });
            await callSignallingService_1.default.handleCallOffer(mockIo, payload);
            expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
            expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents_1.CallEvents.WEBRTC_OFFER, payload);
        });
    });
});
//# sourceMappingURL=callSignallingService.unit.test.js.map