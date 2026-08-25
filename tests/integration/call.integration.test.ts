import { setupTestDB } from '../setupIntegration';
import CallSignallingService from '../../src/services/callSignallingService';
import CallLog from '../../src/models/CallLog';
import { CallStatus } from '../../src/enums/CallStatus.enum';
import { CallEvents } from '../../src/enums/CallEvents';
import mongoose from 'mongoose';
import PrivacyService from '../../src/services/privacyService';
import User from '../../src/models/User';

// Setup in-memory DB
setupTestDB();

// Mock Notification Service
jest.mock('../../src/services/notificationService', () => ({
  NotificationService: {
    sendPushOnly: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('In-App Calling Integration Tests', () => {
  let mockSocketTo: jest.Mock;
  let mockSocketEmit: jest.Mock;
  let mockIo: any;

  let callerId: string;
  let calleeId: string;
  let thirdPartyId: string;

  beforeEach(async () => {
    callerId = new mongoose.Types.ObjectId().toString();
    calleeId = new mongoose.Types.ObjectId().toString();
    thirdPartyId = new mongoose.Types.ObjectId().toString();

    // Create real users so PrivacyService does not fail
    await User.create([
      { _id: callerId, name: 'Caller', email: 'caller@test.com', password: 'Password123!', phone: '+94770000001', callingPrivacy: 'everyone' },
      { _id: calleeId, name: 'Callee', email: 'callee@test.com', password: 'Password123!', phone: '+94770000002', callingPrivacy: 'everyone' },
      { _id: thirdPartyId, name: 'ThirdParty', email: 'tp@test.com', password: 'Password123!', phone: '+94770000003', callingPrivacy: 'everyone' }
    ]);

    mockSocketEmit = jest.fn();
    mockSocketTo = jest.fn().mockReturnValue({ emit: mockSocketEmit });
    mockIo = {
      of: jest.fn().mockReturnValue({
        to: mockSocketTo,
        emit: mockSocketEmit,
      }),
    };
  });

  afterEach(async () => {
    // Clear any open ring timeouts by simulating an end
    if (mockIo) {
      await CallSignallingService.handleCallEnd(mockIo, { callerId, calleeId }, callerId);
    }
    jest.restoreAllMocks();
  });

  describe('Call Initiation and States', () => {
    it('Initiate voice call: should initiate a call successfully', async () => {
      const payload = { caller: { userId: callerId, name: 'Caller' }, calleeId };
      await CallSignallingService.handleCallStart(mockIo, payload as any);

      expect(mockIo.of).toHaveBeenCalledWith('/call');
      expect(mockSocketTo).toHaveBeenCalledWith(`user:${calleeId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.INCOMING, expect.objectContaining(payload));
    });

    it('Busy user: should return BUSY if the callee is already in a call', async () => {
      // Create an active call for callee
      await CallLog.create({
        caller: thirdPartyId,
        receiver: calleeId,
        status: CallStatus.ANSWERED,
        startedAt: new Date()
      });

      const payload = { caller: { userId: callerId, name: 'Caller' }, calleeId };
      await CallSignallingService.handleCallStart(mockIo, payload as any);

      // Should emit BUSY to the caller
      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.BUSY, expect.objectContaining(payload));
    });

    it('Accept call: should establish connection and update call log', async () => {
      // First, simulate a call start to create a missed/ringing log implicitly
      const payload = { caller: { userId: callerId, name: 'Caller' }, calleeId };
      await CallSignallingService.handleCallStart(mockIo, payload as any);
      mockSocketEmit.mockClear();

      // Now accept the call
      await new Promise(r => setTimeout(r, 100)); // wait for RINGING log
      mockSocketTo.mockClear();
      mockSocketEmit.mockClear();
      const acceptPayload = { callerId, calleeId };
      await CallSignallingService.handleCallAccept(mockIo, acceptPayload);

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.ACCEPTED, expect.objectContaining(acceptPayload));

      await new Promise(r => setTimeout(r, 50)); // Wait for floating promise
      const logs = await CallLog.find({ caller: callerId, receiver: calleeId }).sort({ createdAt: -1 });
      expect(logs[0].status).toBe(CallStatus.ANSWERED);
    });

    it('Reject call: should terminate call session with REJECTED status', async () => {
      const payload = { caller: { userId: callerId, name: 'Caller' }, calleeId };
      await CallSignallingService.handleCallStart(mockIo, payload as any);
      mockSocketEmit.mockClear();
      await new Promise(r => setTimeout(r, 100)); // wait for RINGING log
      
      mockSocketTo.mockClear();
      mockSocketEmit.mockClear();
      await CallSignallingService.handleCallDecline(mockIo, { callerId, calleeId });

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.DECLINED, expect.objectContaining({ callerId, calleeId }));

      await new Promise(r => setTimeout(r, 200)); // Wait for floating promise
      const logs = await CallLog.find({ caller: callerId, receiver: calleeId }).sort({ createdAt: -1 });
      expect(logs[0].status).toBe(CallStatus.REJECTED); // Usually recorded as missed or rejected
    });

    it('End active call: should terminate ongoing call and set status to ENDED', async () => {
      // Setup active call directly in DB
      await CallLog.create({ caller: callerId, receiver: calleeId, status: CallStatus.ANSWERED, startedAt: new Date(), answeredAt: new Date() });

      await CallSignallingService.handleCallEnd(mockIo, { callerId, calleeId }, callerId);

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${calleeId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.ENDED, expect.anything());

      await new Promise(r => setTimeout(r, 200)); // Wait for floating promise
      const logs = await CallLog.find({ caller: callerId, receiver: calleeId }).sort({ createdAt: -1 });
      expect(logs[0].status).toBe(CallStatus.ENDED);
      expect(logs[0].duration).toBeDefined();
    });

    it('Invalid call target: should safely reject call initiation if privacy blocks it', async () => {
      // Set the receiver to block calls
      await User.findByIdAndUpdate(calleeId, { callingPrivacy: 'none' });

      const payload = { caller: { userId: callerId, name: 'Caller' }, calleeId };
      await CallSignallingService.handleCallStart(mockIo, payload as any);

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.UNAUTHORIZED, expect.objectContaining(payload));
    });
  });

  describe('WebRTC Signalling', () => {
    beforeEach(async () => {
      await CallLog.create({ caller: callerId, receiver: calleeId, status: CallStatus.ANSWERED, startedAt: new Date() });
    });

    it('WebRTC connection: should successfully exchange offer', async () => {
      const payload = { callerId, calleeId, offer: { type: 'offer', sdp: 'sdp-data' } };
      await CallSignallingService.handleCallOffer(mockIo, payload as any);

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${calleeId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.WEBRTC_OFFER, expect.objectContaining(payload));
    });

    it('WebRTC connection: should successfully exchange answer', async () => {
      const payload = { callerId, calleeId, answer: { type: 'answer', sdp: 'sdp-data' } };
      await CallSignallingService.handleCallAnswer(mockIo, payload as any);

      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.WEBRTC_ANSWER, expect.objectContaining(payload));
    });

    it('Call signalling: should exchange ICE candidates', async () => {
      const payload = { callerId, calleeId, candidate: { candidate: 'ice-candidate-data' } };
      
      // Sent by caller
      await CallSignallingService.handleIceCandidate(mockIo, payload as any, callerId);
      expect(mockSocketTo).toHaveBeenCalledWith(`user:${calleeId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.WEBRTC_ICE_CANDIDATE, expect.objectContaining(payload));

      mockSocketTo.mockClear();
      mockSocketEmit.mockClear();

      // Sent by callee
      await CallSignallingService.handleIceCandidate(mockIo, payload as any, calleeId);
      expect(mockSocketTo).toHaveBeenCalledWith(`user:${callerId}`);
      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.WEBRTC_ICE_CANDIDATE, expect.objectContaining(payload));
    });
  });

  describe('Specific Call Types (Contextual Calling)', () => {
    it('Start call from Lost & Found / Adoption: should pass entity payload correctly', async () => {
      const payload = { 
        caller: { userId: callerId, name: 'Caller' }, 
        calleeId, 
        entity: { type: 'LostAndFound', item: new mongoose.Types.ObjectId().toString() } 
      };
      
      await CallSignallingService.handleCallStart(mockIo, payload as any);

      expect(mockSocketEmit).toHaveBeenCalledWith(CallEvents.INCOMING, expect.objectContaining({
        entity: expect.objectContaining({ type: 'LostAndFound' })
      }));
    });
  });
});
