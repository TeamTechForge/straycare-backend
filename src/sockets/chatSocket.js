// src/sockets/chatSocket.js
module.exports = (io) => {
  const chatNamespace = io.of("/chat");

  chatNamespace.on("connection", (socket) => {
    console.log("Chat socket connected:", socket.id);

    socket.on("join_chat", (roomId) => {
      socket.join(roomId);
    });

    socket.on("send_message", ({ roomId, message, sender }) => {
      chatNamespace.to(roomId).emit("receive_message", { message, sender });
    });

    socket.on("disconnect", () => {
      console.log("Chat socket disconnected:", socket.id);
    });
  });
};
