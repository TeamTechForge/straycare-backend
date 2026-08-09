"use strict";
// src/services/callSignallingService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CallEvents_1 = require("../enums/CallEvents");
const CallStatus_enum_1 = require("../enums/CallStatus.enum");
const Logger_1 = require("../utils/Logger");
const callLogService_1 = __importDefault(require("./callLogService"));
class CallSignallingService {
    constructor() {
        // Mapping of userId -> Set of socketIds in the /call namespace
        this.activeConnections = new Map();
        // Mapping of callerId-calleeId -> NodeJS.Timeout
        this.ringTimeouts = new Map();
    }
    getRingKey(callerId, calleeId) {
        return `${callerId}-${calleeId}`;
    }
    clearRingTimeout(callerId, calleeId) {
        const key = this.getRingKey(callerId, calleeId);
        if (this.ringTimeouts.has(key)) {
            clearTimeout(this.ringTimeouts.get(key));
            this.ringTimeouts.delete(key);
        }
    }
    registerUser(userId, socketId) {
        if (!this.activeConnections.has(userId)) {
            this.activeConnections.set(userId, new Set());
        }
        this.activeConnections.get(userId).add(socketId);
        Logger_1.Logger.info(`[CallSignalling] User ${userId} joined /call. Connections: ${this.activeConnections.get(userId).size}`);
    }
    unregisterUser(userId, socketId) {
        if (this.activeConnections.has(userId)) {
            this.activeConnections.get(userId).delete(socketId);
            if (this.activeConnections.get(userId).size === 0) {
                this.activeConnections.delete(userId);
            }
            Logger_1.Logger.info(`[CallSignalling] User ${userId} left /call.`);
        }
    }
    async handleCallStart(io, payload) {
        const { caller, calleeId } = payload;
        try {
            const activeCall = await callLogService_1.default.findActiveCall(calleeId);
            if (activeCall) {
                Logger_1.Logger.info(`[CallSignalling] User ${calleeId} is BUSY`);
                callLogService_1.default.createLog(caller.userId, calleeId, CallStatus_enum_1.CallStatus.BUSY).catch(Logger_1.Logger.error);
                io.of("/call").to(`user:${caller.userId}`).emit(CallEvents_1.CallEvents.BUSY, payload);
                return;
            }
        }
        catch (error) {
            Logger_1.Logger.error(`[CallSignalling] Error checking busy state`, error);
        }
        try {
            const PrivacyService = require("./privacyService").default;
            const privacyResult = await PrivacyService.canCall(caller.userId, calleeId);
            if (!privacyResult.allowed) {
                Logger_1.Logger.info(`[CallSignalling] Call blocked by privacy: ${privacyResult.reason}`);
                io.of("/call").to(`user:${caller.userId}`).emit(CallEvents_1.CallEvents.UNAUTHORIZED, payload);
                return;
            }
        }
        catch (error) {
            Logger_1.Logger.error(`[CallSignalling] Error checking privacy for call`, error);
        }
        Logger_1.Logger.info(`[CallSignalling] ${caller.userId} is calling ${calleeId}`);
        // We emit to the callee's room (using 'user:${calleeId}' room created on connection)
        io.of("/call").to(`user:${calleeId}`).emit(CallEvents_1.CallEvents.INCOMING, payload);
        // Issue 2: Call Ring Timeout (30 seconds)
        const key = this.getRingKey(caller.userId, calleeId);
        this.clearRingTimeout(caller.userId, calleeId); // Clear any existing just in case
        this.ringTimeouts.set(key, setTimeout(() => {
            Logger_1.Logger.info(`[CallSignalling] Call from ${caller.userId} to ${calleeId} timed out`);
            this.ringTimeouts.delete(key);
            // Complete log -> Because it's still RINGING, it becomes MISSED.
            callLogService_1.default.completeCall(caller.userId, calleeId).catch(Logger_1.Logger.error);
            // Notify both participants to transition to IDLE and cleanup
            const endPayload = { callerId: caller.userId, calleeId };
            io.of("/call").to(`user:${caller.userId}`).emit(CallEvents_1.CallEvents.ENDED, endPayload);
            io.of("/call").to(`user:${calleeId}`).emit(CallEvents_1.CallEvents.ENDED, endPayload);
        }, 30000));
        // Asynchronously create Call Log
        callLogService_1.default.createLog(caller.userId, calleeId).catch(err => Logger_1.Logger.error(`[CallSignalling] Failed to create call log`, err));
    }
    handleCallAccept(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Call accepted by ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents_1.CallEvents.ACCEPTED, payload);
        this.clearRingTimeout(payload.callerId, payload.calleeId);
        // Asynchronously update Call Log to ANSWERED
        callLogService_1.default.markAnswered(payload.callerId, payload.calleeId).catch(err => Logger_1.Logger.error(`[CallSignalling] Failed to mark call answered`, err));
    }
    async verifyActiveSession(userA, userB) {
        try {
            const activeCall = await callLogService_1.default.findActiveCall(userA);
            if (!activeCall)
                return false;
            const callerStr = activeCall.caller.toString();
            const receiverStr = activeCall.receiver.toString();
            return (callerStr === userA && receiverStr === userB) ||
                (callerStr === userB && receiverStr === userA);
        }
        catch (err) {
            return false;
        }
    }
    async handleCallOffer(io, payload) {
        if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
            Logger_1.Logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_OFFER from ${payload.callerId} to ${payload.calleeId}`);
            return;
        }
        Logger_1.Logger.info(`[CallSignalling] Offer from ${payload.callerId} to ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents_1.CallEvents.WEBRTC_OFFER, payload);
    }
    async handleCallAnswer(io, payload) {
        if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
            Logger_1.Logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_ANSWER from ${payload.calleeId} to ${payload.callerId}`);
            return;
        }
        Logger_1.Logger.info(`[CallSignalling] Answer from ${payload.calleeId} to ${payload.callerId}`);
        io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents_1.CallEvents.WEBRTC_ANSWER, payload);
    }
    async handleIceCandidate(io, payload) {
        if (!(await this.verifyActiveSession(payload.callerId, payload.calleeId))) {
            Logger_1.Logger.warn(`[CallSignalling] Security block: Unauthorized WEBRTC_ICE_CANDIDATE from ${payload.callerId} to ${payload.calleeId}`);
            return;
        }
        // Relay candidate to the other peer
        Logger_1.Logger.info(`[CallSignalling] ICE Candidate from ${payload.callerId} to ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents_1.CallEvents.WEBRTC_ICE_CANDIDATE, payload);
    }
    handleCallDecline(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Call declined by ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents_1.CallEvents.DECLINED, payload);
        this.clearRingTimeout(payload.callerId, payload.calleeId);
        // Asynchronously update Call Log to REJECTED
        callLogService_1.default.markRejected(payload.callerId, payload.calleeId).catch(err => Logger_1.Logger.error(`[CallSignalling] Failed to mark call rejected`, err));
    }
    handleCallEnd(io, payload, endedByUserId) {
        Logger_1.Logger.info(`[CallSignalling] Call ended by ${endedByUserId || payload.callerId} for caller: ${payload.callerId}, callee: ${payload.calleeId}`);
        this.clearRingTimeout(payload.callerId, payload.calleeId);
        // Issue 1: Bidirectional Call Termination
        // We notify the OTHER user. If endedByUserId is caller, notify callee. If callee, notify caller.
        // Fallback to calleeId if endedByUserId is not provided (legacy support).
        const targetUserId = endedByUserId === payload.callerId ? payload.calleeId : (endedByUserId === payload.calleeId ? payload.callerId : payload.calleeId);
        io.of("/call").to(`user:${targetUserId}`).emit(CallEvents_1.CallEvents.ENDED, payload);
        // Asynchronously complete Call Log (MISSED or ENDED)
        // Note: The one who ends the call sends their ID as callerId, which might be the actual receiver. 
        // Wait! The payload might have callerId/calleeId swapped depending on who hangs up!
        // To fix this without swapping, completeCall finds any active call between them.
        callLogService_1.default.completeCall(payload.callerId, payload.calleeId).catch(err => Logger_1.Logger.error(`[CallSignalling] Failed to complete call log`, err));
    }
    async handleDisconnect(io, userId) {
        Logger_1.Logger.info(`[CallSignalling] Handling disconnect for user ${userId}`);
        try {
            const activeCall = await callLogService_1.default.findActiveCall(userId);
            if (activeCall) {
                const callerId = activeCall.caller.toString();
                const calleeId = activeCall.receiver.toString();
                Logger_1.Logger.info(`[CallSignalling] Found active call for disconnected user ${userId}. Automatically ending call.`);
                const payload = { callerId, calleeId };
                // Use handleCallEnd directly, which clears timeout, notifies the remaining participant, and completes the log
                this.handleCallEnd(io, payload, userId);
            }
        }
        catch (err) {
            Logger_1.Logger.error(`[CallSignalling] Error handling disconnect for ${userId}`, err);
        }
    }
}
exports.default = new CallSignallingService();
//# sourceMappingURL=callSignallingService.js.map