import CallSignallingService from '../../../src/services/callSignallingService';
import callLogService from '../../../src/services/callLogService';
import PrivacyService from '../../../src/services/privacyService';
import { CallEvents } from '../../../src/enums/CallEvents';
import { CallStatus } from '../../../src/enums/CallStatus.enum';

jest.mock('../../../src/services/callLogService');
jest.mock('../../../src/services/privacyService');
jest.mock('../../../src/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('Call Signalling Service Unit Tests', () => {
  let mockIo: any;
  let mockSocketTo: any;
  let mockSocketEmit: any;

  beforeEach(() => {
    mockSocketEmit = jest.fn();
    mockSocketTo = jest.fn().mockReturnValue({ emit: mockSocketEmit });
    mockIo = {
      of: jest.fn().mockReturnValue({
        to: mockSocketTo,
      })
    };
    
    // Ensure all mocked async functions return a promise to prevent .catch() undefined errors
    (callLogService.createLog as jest.Mock).mockResolvedValue(undefined);
    (callLogService.markAnswered as jest.Mock).mockResolvedValue(undefined);
    (callLogService.markRejected as jest.Mock).mockResolvedValue(undefined);
    (callLogService.completeCall as jest.Mock).mockResolvedValue(undefined);

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('handleCallStart', () => {
    const payload = { caller: { userId: 'user1', name: 'User 1' }, calleeId: 'user2' };

    it('should emit BUSY if callee has an active call', async () => {
      (callLogService.findActiveCall as jest.Mock).mockResolvedValue({ _id: 'active1' });

      await CallSignallingService.handleCallStart(mockIo, payload);

      expect(callLogService.findActiveCall).toHaveBeenCalledWith('user2');
      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.BUSY, payload);
      expect(callLogService.createLog).toHaveBeenCalledWith('user1', 'user2', CallStatus.BUSY);
    });

    it('should emit UNAUTHORIZED if privacy blocks the call', async () => {
      (callLogService.findActiveCall as jest.Mock).mockResolvedValue(null);
      (PrivacyService.canCall as jest.Mock).mockResolvedValue({ allowed: false, reason: 'Blocked' });

      await CallSignallingService.handleCallStart(mockIo, payload);

      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.UNAUTHORIZED, payload);
    });

    it('should emit INCOMING to callee and start ring timeout if allowed', async () => {
      (callLogService.findActiveCall as jest.Mock).mockResolvedValue(null);
      (PrivacyService.canCall as jest.Mock).mockResolvedValue({ allowed: true });

      await CallSignallingService.handleCallStart(mockIo, payload);

      expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.INCOMING, payload);
      expect(callLogService.createLog).toHaveBeenCalledWith('user1', 'user2');

      // Fast forward 30 seconds to trigger timeout
      jest.advanceTimersByTime(30000);

      // Verify timeout behavior
      expect(callLogService.completeCall).toHaveBeenCalledWith('user1', 'user2');
      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.ENDED, { callerId: 'user1', calleeId: 'user2' });
    });
  });

  describe('handleCallAccept', () => {
    it('should emit ACCEPTED to caller and mark call answered', () => {
      const payload = { callerId: 'user1', calleeId: 'user2' };
      CallSignallingService.handleCallAccept(mockIo, payload);

      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.ACCEPTED, payload);
      expect(callLogService.markAnswered).toHaveBeenCalledWith('user1', 'user2');
    });
  });

  describe('handleCallDecline', () => {
    it('should emit DECLINED to caller and mark call rejected', () => {
      const payload = { callerId: 'user1', calleeId: 'user2' };
      CallSignallingService.handleCallDecline(mockIo, payload);

      expect(mockSocketTo).toHaveBeenCalledWith('user:user1');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.DECLINED, payload);
      expect(callLogService.markRejected).toHaveBeenCalledWith('user1', 'user2');
    });
  });

  describe('handleCallEnd', () => {
    it('should emit ENDED to the other participant and complete the call log', () => {
      const payload = { callerId: 'user1', calleeId: 'user2' };
      // User1 ends the call, should notify User2
      CallSignallingService.handleCallEnd(mockIo, payload, 'user1');

      expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.ENDED, payload);
      expect(callLogService.completeCall).toHaveBeenCalledWith('user1', 'user2');
    });
  });

  describe('WebRTC Security (verifyActiveSession)', () => {
    const payload = { callerId: 'user1', calleeId: 'user2', offer: {} as any };

    it('should block WebRTC Offer if no active session exists', async () => {
      (callLogService.findActiveCall as jest.Mock).mockResolvedValue(null);

      await CallSignallingService.handleCallOffer(mockIo, payload);

      // Should not emit
      expect(mockSocketTo).not.toHaveBeenCalled();
    });

    it('should emit WebRTC Offer if active session exists between the two users', async () => {
      // Mock an active call between user1 and user2
      (callLogService.findActiveCall as jest.Mock).mockResolvedValue({
        caller: { toString: () => 'user1' },
        receiver: { toString: () => 'user2' }
      });

      await CallSignallingService.handleCallOffer(mockIo, payload);

      expect(mockSocketTo).toHaveBeenCalledWith('user:user2');
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.WEBRTC_OFFER, payload);
    });
  });
});
