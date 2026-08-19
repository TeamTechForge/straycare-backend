import type { Server, Socket } from "socket.io";

module.exports = (io: Server) => {
  const rescueNamespace = io.of("/rescue");

  rescueNamespace.on("connection", (socket: Socket) => {
    console.log("Rescue socket connected:", socket.id);

    // Join room per rescue request so updates can be targeted to the case.
    socket.on("join_rescue", (rescueId: string) => {
      if (!rescueId) return;
      socket.join(String(rescueId));
    });

    socket.on("leave_rescue", (rescueId: string) => {
      if (!rescueId) return;
      socket.leave(String(rescueId));
    });

    // Live location updates from rescuer
    socket.on("location_update", (data: any) => {
      const { rescueId } = data || {};
      if (rescueId) {
        rescueNamespace.to(String(rescueId)).emit("location_update", data);
      }
    });

    // Location sharing toggle status
    socket.on("location_sharing_status", (data: any) => {
      const { rescueId } = data || {};
      if (rescueId) {
        rescueNamespace.to(String(rescueId)).emit("location_sharing_status", data);
      }
    });

    // Status updates
    socket.on("status_update", ({ rescueId, status }: { rescueId: string; status: string }) => {
      rescueNamespace.to(rescueId).emit("status_update", { status });
    });

    socket.on("rescue_assigned_ack", ({ rescueId, rescuerId }: { rescueId: string; rescuerId: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("rescue-assigned", {
        requestId: String(rescueId),
        rescuerId: rescuerId ? String(rescuerId) : null,
      });
    });

    socket.on("rescue_rejected_ack", ({ rescueId, rescuerId, reason }: { rescueId: string; rescuerId: string; reason: string }) => {
      if (!rescueId) return;
      rescueNamespace.to(String(rescueId)).emit("rescue-rejected", {
        requestId: String(rescueId),
        rescuerId: rescuerId ? String(rescuerId) : null,
        reason: reason || "rejected",
      });
    });

    socket.on("rescue_broadcast_ack", ({ rescueId }: { rescueId: string }) => {
      if (!rescueId) return;
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
