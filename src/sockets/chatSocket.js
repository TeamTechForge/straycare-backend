// src/sockets/chatSocket.js
//
// Real-time chat events via Socket.IO /chat namespace.
// Handles: online tracking, room joining, typing indicators, read receipts.
// Message persistence is handled by the REST API (chatController.js);
// this socket layer only relays real-time events to connected clients.

const onlineUsers = new Map(); // userId → Set<socketId>

module.exports = (io) => {
  const chatNamespace = io.of("/chat");

  chatNamespace.on("connection", (socket) => {
    console.log("[Chat Socket] Connected:", socket.id);

    // ── User comes online ────────────────────────────────────
    socket.on("user:join", ({ userId }) => {
      if (!userId) return;

      socket.userId = userId;

      // Track all sockets for this user (supports multiple devices)
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Broadcast online status to all connected clients
      chatNamespace.emit("user:online", { userId });

      console.log(`[Chat Socket] User ${userId} online (${onlineUsers.get(userId).size} connections)`);
    });

    // ── Join a conversation room ─────────────────────────────
    // Called when user opens a chat screen.
    socket.on("join_chat", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`[Chat Socket] ${socket.userId || socket.id} joined room ${conversationId}`);
    });

    // ── Leave a conversation room ────────────────────────────
    socket.on("leave_chat", (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
    });

    // ── Typing indicators ────────────────────────────────────
    socket.on("user:typing", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      socket.to(conversationId).emit("typing", { conversationId, userId });
    });

    socket.on("user:stop-typing", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      socket.to(conversationId).emit("stop-typing", { conversationId, userId });
    });

    // ── Read receipts ────────────────────────────────────────
    // Client sends this after marking messages as read via REST API.
    // This event notifies the other participant in real-time.
    socket.on("message:read", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;
      socket.to(conversationId).emit("message:read-ack", {
        conversationId,
        readBy: userId,
      });
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on("disconnect", () => {
      const userId = socket.userId;

      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);

        // Only broadcast offline if ALL sockets for this user are gone
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
          chatNamespace.emit("user:offline", { userId });
          console.log(`[Chat Socket] User ${userId} offline`);
        }
      }

      console.log("[Chat Socket] Disconnected:", socket.id);
    });
  });

  // Expose online users map so controllers/routes can check online status
  chatNamespace.getOnlineUsers = () => onlineUsers;
};
