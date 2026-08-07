"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = (io) => {
    const rescueNamespace = io.of("/rescue");
    rescueNamespace.on("connection", (socket) => {
        console.log("Rescue socket connected:", socket.id);
        // Join room per rescue request so updates can be targeted to the case.
        socket.on("join_rescue", (rescueId) => {
            if (!rescueId)
                return;
            socket.join(String(rescueId));
        });
        socket.on("leave_rescue", (rescueId) => {
            if (!rescueId)
                return;
            socket.leave(String(rescueId));
        });
        // Live location updates from rescuer
        socket.on("location_update", ({ rescueId, lat, lng }) => {
            rescueNamespace.to(rescueId).emit("location_update", { lat, lng });
        });
        // Status updates
        socket.on("status_update", ({ rescueId, status }) => {
            rescueNamespace.to(rescueId).emit("status_update", { status });
        });
        socket.on("rescue_assigned_ack", ({ rescueId, rescuerId }) => {
            if (!rescueId)
                return;
            rescueNamespace.to(String(rescueId)).emit("rescue-assigned", {
                requestId: String(rescueId),
                rescuerId: rescuerId ? String(rescuerId) : null,
            });
        });
        socket.on("rescue_rejected_ack", ({ rescueId, rescuerId, reason }) => {
            if (!rescueId)
                return;
            rescueNamespace.to(String(rescueId)).emit("rescue-rejected", {
                requestId: String(rescueId),
                rescuerId: rescuerId ? String(rescuerId) : null,
                reason: reason || "rejected",
            });
        });
        socket.on("rescue_broadcast_ack", ({ rescueId }) => {
            if (!rescueId)
                return;
            rescueNamespace.to(String(rescueId)).emit("rescue-broadcast", {
                requestId: String(rescueId),
                message: "Request sent",
            });
        });
        socket.on("disconnect", () => {
            console.log("Rescue socket disconnected:", socket.id);
        });
    });
};
//# sourceMappingURL=rescueSocket.js.map