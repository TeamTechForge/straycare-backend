"use strict";
// src/sockets/callSocket.ts
//
// Real-time call signalling events via Socket.IO /call namespace.
// Delegates all business logic to CallSignallingService.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CallEvents_1 = require("../enums/CallEvents");
const CallSignallingService_1 = __importDefault(require("../services/CallSignallingService"));
const Logger_1 = require("../utils/Logger");
module.exports = (io) => {
    const callNamespace = io.of("/call");
    callNamespace.on("connection", (socket) => {
        Logger_1.Logger.info(`[Call Socket] Connected: ${socket.id}`);
        // Join /call namespace
        socket.on("user:join", ({ userId }) => {
            if (!userId)
                return;
            socket.userId = userId;
            // Personal room for direct user-to-user routing
            socket.join(`user:${userId}`);
            CallSignallingService_1.default.registerUser(userId, socket.id);
        });
        // Handle incoming call request
        socket.on(CallEvents_1.CallEvents.START, (payload) => {
            CallSignallingService_1.default.handleCallStart(io, payload);
        });
        // Handle call accepted/declined/ended
        socket.on(CallEvents_1.CallEvents.DECLINED, (payload) => {
            CallSignallingService_1.default.handleCallDecline(io, payload);
        });
        socket.on(CallEvents_1.CallEvents.ENDED, (payload) => {
            CallSignallingService_1.default.handleCallEnd(io, payload);
        });
        // WebRTC Signalling: Offer, Answer, ICE
        socket.on(CallEvents_1.CallEvents.WEBRTC_OFFER, (payload) => {
            CallSignallingService_1.default.handleCallOffer(io, payload);
        });
        socket.on(CallEvents_1.CallEvents.WEBRTC_ANSWER, (payload) => {
            CallSignallingService_1.default.handleCallAnswer(io, payload);
        });
        socket.on(CallEvents_1.CallEvents.WEBRTC_ICE_CANDIDATE, (payload) => {
            CallSignallingService_1.default.handleIceCandidate(io, payload);
        });
        socket.on("disconnect", () => {
            if (socket.userId) {
                CallSignallingService_1.default.unregisterUser(socket.userId, socket.id);
            }
            Logger_1.Logger.info(`[Call Socket] Disconnected: ${socket.id}`);
        });
    });
};
//# sourceMappingURL=callSocket.js.map