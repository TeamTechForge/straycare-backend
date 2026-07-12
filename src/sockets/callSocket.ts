// src/sockets/callSocket.ts
//
// Real-time call signalling events via Socket.IO /call namespace.
// Delegates all business logic to CallSignallingService.

import type { Server, Socket } from "socket.io";
import { CallEvents } from "../enums/CallEvents";
import CallSignallingService from "../services/CallSignallingService";
import { Logger } from "../utils/Logger";


interface CallSocket extends Socket {
  userId?: string;
}

module.exports = (io: Server) => {
  const callNamespace = io.of("/call");

  callNamespace.on("connection", (socket: CallSocket) => {
    Logger.info(`[Call Socket] Connected: ${socket.id}`);

    // Join /call namespace
    socket.on("user:join", ({ userId }: { userId: string }) => {
      if (!userId) return;
      socket.userId = userId;

      // Personal room for direct user-to-user routing
      socket.join(`user:${userId}`);

      CallSignallingService.registerUser(userId, socket.id);
    });

    // Handle incoming call request
    socket.on(CallEvents.START, (payload) => {
      CallSignallingService.handleCallStart(io, payload);
    });

    // Handle call accepted/declined/ended
    socket.on(CallEvents.ACCEPTED, (payload) => {
      CallSignallingService.handleCallAccept(io, payload);
    });

    socket.on(CallEvents.DECLINED, (payload) => {
      CallSignallingService.handleCallDecline(io, payload);
    });

    socket.on(CallEvents.ENDED, (payload) => {
      CallSignallingService.handleCallEnd(io, payload, socket.userId);
    });

    // WebRTC Signalling: Offer, Answer, ICE
    socket.on(CallEvents.WEBRTC_OFFER, (payload) => {
      CallSignallingService.handleCallOffer(io, payload);
    });

    socket.on(CallEvents.WEBRTC_ANSWER, (payload) => {
      CallSignallingService.handleCallAnswer(io, payload);
    });

    socket.on(CallEvents.WEBRTC_ICE_CANDIDATE, (payload) => {
      CallSignallingService.handleIceCandidate(io, payload);
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        CallSignallingService.handleDisconnect(io, socket.userId);
        CallSignallingService.unregisterUser(socket.userId, socket.id);
      }
      Logger.info(`[Call Socket] Disconnected: ${socket.id}`);
    });
  });
};
