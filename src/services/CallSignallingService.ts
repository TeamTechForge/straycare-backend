// src/services/CallSignallingService.ts

import { Server } from "socket.io";
import { CallEvents } from "../enums/CallEvents";
import { ICallStartDTO, ICallOfferDTO, ICallAnswerDTO, IIceCandidateDTO, ICallEndDTO, ICallDeclineDTO, ICallAcceptDTO } from "../types/call";
import { Logger as logger } from "../utils/Logger";

class CallSignallingService {
  // Mapping of userId -> Set of socketIds in the /call namespace
  private activeConnections: Map<string, Set<string>> = new Map();

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

  public handleCallStart(io: Server, payload: ICallStartDTO) {
    const { caller, calleeId } = payload;
    logger.info(`[CallSignalling] ${caller.userId} is calling ${calleeId}`);
    
    // We emit to the callee's room (using 'user:${calleeId}' room created on connection)
    io.of("/call").to(`user:${calleeId}`).emit(CallEvents.INCOMING, payload);
  }

  public handleCallAccept(io: Server, payload: ICallAcceptDTO) {
    logger.info(`[CallSignalling] Call accepted by ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.ACCEPTED, payload);
  }

  public handleCallOffer(io: Server, payload: ICallOfferDTO) {
    logger.info(`[CallSignalling] Offer from ${payload.callerId} to ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents.WEBRTC_OFFER, payload);
  }

  public handleCallAnswer(io: Server, payload: ICallAnswerDTO) {
    logger.info(`[CallSignalling] Answer from ${payload.calleeId} to ${payload.callerId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.WEBRTC_ANSWER, payload);
  }

  public handleIceCandidate(io: Server, payload: IIceCandidateDTO) {
    // Relay candidate to the other peer
    logger.info(`[CallSignalling] ICE Candidate from ${payload.callerId} to ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents.WEBRTC_ICE_CANDIDATE, payload);
  }

  public handleCallDecline(io: Server, payload: ICallDeclineDTO) {
    logger.info(`[CallSignalling] Call declined by ${payload.calleeId}`);
    io.of("/call").to(`user:${payload.callerId}`).emit(CallEvents.DECLINED, payload);
  }

  public handleCallEnd(io: Server, payload: ICallEndDTO) {
    logger.info(`[CallSignalling] Call ended by ${payload.callerId} for ${payload.calleeId}`);
    // Notify the other user
    io.of("/call").to(`user:${payload.calleeId}`).emit(CallEvents.ENDED, payload);
  }
}

export default new CallSignallingService();
