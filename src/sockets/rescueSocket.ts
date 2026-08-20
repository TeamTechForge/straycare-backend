import type { Server, Socket } from "socket.io";

// rescueSocket.ts
//
// Handles real-time communication for active rescues using Socket.io.
// This allows live location tracking, status changes, and rescue assignment alerts
// between the person reporting the stray animal and the rescuer.

module.exports = (io: Server) => {

  // Dedicated namespace for rescue-related socket events.
  // Both the mobile app and rescuers connect to this namespace.
  const rescueNamespace = io.of("/rescue");

  rescueNamespace.on("connection", (socket: Socket) => {
    console.log("Rescue socket connected:", socket.id);

    // Join a specific rescue room.
    // Each rescue case has its own unique room (rescueId).
    // This ensures updates are sent only to the users involved in that rescue.
    socket.on("join_rescue", (rescueId: string) => {
      if (!rescueId) return;

      console.log(`[SOCKET] Socket ${socket.id} joined rescue room: ${rescueId}`);
      socket.join(String(rescueId));
    });

    // Leave the rescue room when the user closes the screen or rescue finishes.
    socket.on("leave_rescue", (rescueId: string) => {
      if (!rescueId) return;

      console.log(`[SOCKET] Socket ${socket.id} left rescue room: ${rescueId}`);
      socket.leave(String(rescueId));
    });

    // Live GPS location updates from the moving rescuer.
    // When the rescuer moves, their coordinates are broadcasted
    // to everyone inside the rescue room (so the reporter can see them on the map).
    socket.on("location_update", (data: any) => {
      const { rescueId } = data || {};
      if (rescueId) {
        rescueNamespace.to(String(rescueId)).emit("location_update", data);
      }
    });

    // Turn location sharing on or off.
    // Informs the other party whether the rescuer is currently sharing live GPS.
    socket.on("location_sharing_status", (data: any) => {
      const { rescueId } = data || {};
      if (rescueId) {
        rescueNamespace.to(String(rescueId)).emit("location_sharing_status", data);
      }
    });

    // Rescue status updates (e.g., EN_ROUTE, ARRIVED, COMPLETED, CANCELLED).
    // Informs everyone in the room when the rescue status changes.
    socket.on("status_update", ({ rescueId, status }: { rescueId: string; status: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("status_update", { status });
    });

    // Acknowledgment when a rescuer accepts the direct rescue request.
    // Notifies the reporter that a rescuer has accepted and is on the way.
    socket.on("rescue_assigned_ack", ({ rescueId, rescuerId }: { rescueId: string; rescuerId: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("rescue-assigned", {
        requestId: String(rescueId),
        rescuerId: rescuerId ? String(rescuerId) : null,
      });
    });

    // Acknowledgment when a rescuer rejects the direct rescue request.
    // Allows the system or user to fall back or find another rescuer.
    socket.on("rescue_rejected_ack", ({ rescueId, rescuerId, reason }: { rescueId: string; rescuerId: string; reason: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("rescue-rejected", {
        requestId: String(rescueId),
        rescuerId: rescuerId ? String(rescuerId) : null,
        reason: reason || "rejected",
      });
    });

    // Broadcast acknowledgment when a rescue case is published publicly to the map.
    socket.on("rescue_broadcast_ack", ({ rescueId }: { rescueId: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("rescue-broadcast", {
        requestId: String(rescueId),
        message: "Request sent",
      });
    });

    // Handle user or rescuer disconnection from the socket.
    socket.on("disconnect", () => {
      console.log("Rescue socket disconnected:", socket.id);
    });
  });
};

