// src/sockets/rescueSocket.js
module.exports = (io) => {
  const rescueNamespace = io.of("/rescue");

  rescueNamespace.on("connection", (socket) => {
    console.log("Rescue socket connected:", socket.id);

    // Join room per rescueId
    socket.on("join_rescue", (rescueId) => {
      socket.join(rescueId);
    });

    // Live location updates from rescuer
    socket.on("location_update", ({ rescueId, lat, lng }) => {
      rescueNamespace.to(rescueId).emit("location_update", { lat, lng });
    });

    // Status updates
    socket.on("status_update", ({ rescueId, status }) => {
      rescueNamespace.to(rescueId).emit("status_update", { status });
    });

    socket.on("disconnect", () => {
      console.log("Rescue socket disconnected:", socket.id);
    });
  });
};
