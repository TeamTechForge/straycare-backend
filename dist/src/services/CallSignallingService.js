"use strict";
// src/services/CallSignallingService.ts
Object.defineProperty(exports, "__esModule", { value: true });
const CallEvents_1 = require("../enums/CallEvents");
const Logger_1 = require("../utils/Logger");
class CallSignallingService {
    constructor() {
        // Mapping of userId -> Set of socketIds in the /call namespace
        this.activeConnections = new Map();
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
    handleCallStart(io, payload) {
        const { caller, calleeId } = payload;
        Logger_1.Logger.info(`[CallSignalling] ${caller.userId} is calling ${calleeId}`);
        // We emit to the callee's room (using 'user:${calleeId}' room created on connection)
        io.of("/call").to(`user:${calleeId}`).emit(CallEvents_1.CallEvents.INCOMING, payload);
    }
    handleCallOffer(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Offer from ${payload.callerId} to ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents_1.CallEvents.WEBRTC_OFFER, payload);
    }
    handleCallAnswer(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Answer from ${payload.calleeId} to ${payload.callerId}`);
        io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents_1.CallEvents.WEBRTC_ANSWER, payload);
    }
    handleIceCandidate(io, payload) {
        // Relay candidate to the other peer
        Logger_1.Logger.info(`[CallSignalling] ICE Candidate from ${payload.callerId} to ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents_1.CallEvents.WEBRTC_ICE_CANDIDATE, payload);
    }
    handleCallDecline(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Call declined by ${payload.calleeId}`);
        io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents_1.CallEvents.DECLINED, payload);
    }
    handleCallEnd(io, payload) {
        Logger_1.Logger.info(`[CallSignalling] Call ended by ${payload.callerId} for ${payload.calleeId}`);
        // Notify the other user
        io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents_1.CallEvents.ENDED, payload);
    }
}
exports.default = new CallSignallingService();
//# sourceMappingURL=CallSignallingService.js.map