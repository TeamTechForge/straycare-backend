// src/services/callSignallingService.ts

import { Server } from "socket.io";
import { CallEvents } from "../enums/CallEvents";
import { ICallStartDTO, ICallOfferDTO, ICallAnswerDTO, IIceCandidateDTO, ICallEndDTO, ICallDeclineDTO, ICallAcceptDTO } from "../types/call";
import { CallStatus } from "../enums/CallStatus.enum";
import { Logger as logger } from "../utils/logger";
import callLogService from "./callLogService";
import { NotificationService } from "./notificationService";

class CallSignallingService {
  // Mapping of userId -> Set of socketIds in the /call namespace
  private activeConnections: Map<string, Set<string>> = new Map();

  // Mapping of callerId-calleeId -> NodeJS.Timeout
  private ringTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private getRingKey(callerId: string, calleeId: string): string {
    return `${callerId}-${calleeId}`;
  }

  private clearRingTimeout(callerId: string, calleeId: string) {
    const key = this.getRingKey(callerId, calleeId);
    if (this.ringTimeouts.has(key)) {
      clearTimeout(this.ringTimeouts.get(key));
      this.ringTimeouts.delete(key);
    }
  }

  public registerUser(userId: string, socketId: string) {
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId)!.add(socketId);
    logger.info(`[CallSignalling] User ${userId} joined /call. Connections: ${this.activeConnections.get(userId)!.size}`);
  }

  public unregisterUser(userId: string, socketId: string) {
    if (this.activeConnections.has(userId)) {
      this.activeConnections.get(userId)!.delete(socketId);
      if (this.activeConnections.get(userId)!.size === 0) {
        this.activeConnections.delete(userId);
      }
      logger.info(`[CallSignalling] User ${userId} left /call.`);
    }
  }

  public async handleCallStart(io: Server, payload: ICallStartDTO) {
    const { caller, calleeId } = payload;
    
    try {
      const activeCall = await callLogService.findActiveCall(calleeId);
      if (activeCall) {
        logger.info(`[CallSignalling] User ${calleeId} is BUSY`);
        callLogService.createLog(caller.userId, calleeId, CallStatus.BUSY, payload.callerNameOverride, payload.receiverNameOverride).catch(logger.error);
        io.of("/call").to(`user:${caller.userId}`).emit(CallEvents.BUSY, payload);
        return;
      }
    } catch (error) {
      logger.error(`[CallSignalling] Error checking busy state`, error);
    }

    try {
      const PrivacyService = require("./privacyService").default;
      const privacyResult = await PrivacyService.canCall(caller.userId, calleeId);
      if (!privacyResult.allowed) {
        logger.info(`[CallSignalling] Call blocked by privacy: ${privacyResult.reason}`);
        io.of("/call").to(`user:${caller.userId}`).emit(CallEvents.UNAUTHORIZED, payload);
        return;
      }
    } catch (error) {
      logger.error(`[CallSignalling] Error checking privacy for call`, error);
    }

    logger.info(`[CallSignalling] ${caller.userId} is calling ${calleeId}`);
    
    // Check if this call is related to an anonymous rescue request
    try {
      const RescueRequest = require("../models/RescueRequest");
      const activeRescue = await RescueRequest.findOne({
        status: { $in: ["pending", "accepted", "in_progress"] },
        $or: [
          { userId: caller.userId, rescuerId: calleeId },
          { userId: calleeId, rescuerId: caller.userId }
        ]
      }).lean();

      if (activeRescue && (activeRescue.anonymous || activeRescue.reporterName === "Anonymous Reporter")) {
        const fullCaseId = activeRescue._id.toString();
        const maskedName = `Anonymous Report (${fullCaseId})`;
        
        payload.callerNameOverride = maskedName;
        payload.caller.name = maskedName;
        
        // Ensure receiverNameOverride is also consistent for the frontend
        if (!payload.receiverNameOverride) {
          payload.receiverNameOverride = `Anonymous Reporter (${fullCaseId})`;
        }
      }
    } catch (error) {
      logger.error(`[CallSignalling] Error checking anonymous rescue status`, error);
    }

    // We emit to the callee's room (using 'user:${calleeId}' room created on connection)
    io.of("/call").to(`user:${calleeId}`).emit(CallEvents.INCOMING, payload);

    // Send push notification for incoming call
    NotificationService.sendPushOnly(
      calleeId,
      payload.caller.name || "Someone",
      "📞 Incoming call...",
      { action: "call", callerId: caller.userId }
    ).catch(err => logger.error(`[CallSignalling] Push error:`, err));

    // Issue 2: Call Ring Timeout (30 seconds)
    const key = this.getRingKey(caller.userId, calleeId);
    this.clearRingTimeout(caller.userId, calleeId); // Clear any existing just in case
    
    this.ringTimeouts.set(key, setTimeout(() => {
      logger.info(`[CallSignalling] Call from ${caller.userId} to ${calleeId} timed out`);
      this.ringTimeouts.delete(key);
      
      // Complete log -> Because it's still RINGING, it becomes MISSED.
      callLogService.completeCall(caller.userId, calleeId).catch(logger.error);

      // Notify both participants to transition to IDLE and cleanup
      const endPayload: ICallEndDTO = { callerId: caller.userId, calleeId };
      io.of("/call").to(`user:${caller.userId}`).emit(CallEvents.ENDED, endPayload);
      io.of("/call").to(`user:${calleeId}`).emit(CallEvents.ENDED, endPayload);
    }, 30000));

    // Asynchronously create Call Log
    callLogService.createLog(caller.userId, calleeId, CallStatus.RINGING, payload.callerNameOverride, payload.receiverNameOverride).catch(err => 
      logger.error(`[CallSignalling] Failed to create call log`, err)
    );
  }

  public handleCallAccept(io: Server, payload: ICallAcceptDTO) {
    logger.info(`[CallSignalling] Call accepted by ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.ACCEPTED, payload);

    this.clearRingTimeout(payload.callerId, payload.calleeId);

    // Asynchronously update Call Log to ANSWERED
    callLogService.markAnswered(payload.callerId, payload.calleeId).catch(err => 
      logger.error(`[CallSignalling] Failed to mark call answered`, err)
    );
  }

  private async verifyActiveSession(userA: string, userB: string): Promise<boolean> {
    try {
      const activeCall = await callLogService.findActiveCall(userA);
      if (!activeCall) return false;
      const callerStr = activeCall.caller.toString();
      const receiverStr = activeCall.receiver.toString();
      return (callerStr === userA && receiverStr === userB) ||
             (callerStr === userB && receiverStr === userA);
    } catch (err) {
      return false;
    }
  }

  public async handleCallOffer(io: Server, payload: ICallOfferDTO) {
    if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
      logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_OFFER from ${payload.callerId} to ${payload.calleeId}`);
      return;
    }
    logger.info(`[CallSignalling] Offer from ${payload.callerId} to ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents.WEBRTC_OFFER, payload);
  }

  public async handleCallAnswer(io: Server, payload: ICallAnswerDTO) {
    if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
      logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_ANSWER from ${payload.calleeId} to ${payload.callerId}`);
      return;
    }
    logger.info(`[CallSignalling] Answer from ${payload.calleeId} to ${payload.callerId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.WEBRTC_ANSWER, payload);
  }

  public async handleIceCandidate(io: Server, payload: IIceCandidateDTO, senderId?: string) {
    if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
      logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_ICE_CANDIDATE from ${payload.callerId} to ${payload.calleeId}`);
      return;
    }
    // Relay candidate to the other peer
    const targetId = senderId === payload.callerId ? payload.calleeId : payload.callerId;
    logger.info(`[CallSignalling] ICE Candidate from ${senderId} to ${targetId}`);
    io.of("/call").to(`user:${targetId}`).emit(CallEvents.WEBRTC_ICE_CANDIDATE, payload);
  }

  public handleCallDecline(io: Server, payload: ICallDeclineDTO) {
    logger.info(`[CallSignalling] Call declined by ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.DECLINED, payload);

    this.clearRingTimeout(payload.callerId, payload.calleeId);

    // Asynchronously update Call Log to REJECTED
    callLogService.markRejected(payload.callerId, payload.calleeId).catch(err => 
      logger.error(`[CallSignalling] Failed to mark call rejected`, err)
    );
  }

  public handleCallEnd(io: Server, payload: ICallEndDTO, endedByUserId?: string) {
    logger.info(`[CallSignalling] Call ended by ${endedByUserId || payload.callerId} for caller: ${payload.callerId}, callee: ${payload.calleeId}`);
    
    this.clearRingTimeout(payload.callerId, payload.calleeId);

    // Issue 1: Bidirectional Call Termination
    // We notify the OTHER user. If endedByUserId is caller, notify callee. If callee, notify caller.
    // Fallback to calleeId if endedByUserId is not provided (legacy support).
    const targetUserId = endedByUserId === payload.callerId ? payload.calleeId : (endedByUserId === payload.calleeId ? payload.callerId : payload.calleeId);
    
    io.of("/call").to(`user:${targetUserId}`).emit(CallEvents.ENDED, payload);

    // Asynchronously complete Call Log (MISSED or ENDED)
    // Note: The one who ends the call sends their ID as callerId, which might be the actual receiver. 
    // Wait! The payload might have callerId/calleeId swapped depending on who hangs up!
    // To fix this without swapping, completeCall finds any active call between them.
    callLogService.completeCall(payload.callerId, payload.calleeId).catch(err => 
      logger.error(`[CallSignalling] Failed to complete call log`, err)
    );
  }

  public async handleDisconnect(io: Server, userId: string) {
    logger.info(`[CallSignalling] Handling disconnect for user ${userId}`);
    try {
      const activeCall = await callLogService.findActiveCall(userId);
      if (activeCall) {
        const callerId = activeCall.caller.toString();
        const calleeId = activeCall.receiver.toString();
        
        logger.info(`[CallSignalling] Found active call for disconnected user ${userId}. Automatically ending call.`);
        
        const payload: ICallEndDTO = { callerId, calleeId };
        
        // Use handleCallEnd directly, which clears timeout, notifies the remaining participant, and completes the log
        this.handleCallEnd(io, payload, userId);
      }
    } catch (err) {
      logger.error(`[CallSignalling] Error handling disconnect for ${userId}`, err);
    }
  }
}

export default new CallSignallingService();
