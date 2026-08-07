// src/routes/chatRoutes.ts
const express = require("express");
const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  deleteMessage,
} = require("../controllers/chatController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// All chat routes require authentication
router.get("/conversations", verifyToken, getConversations);
router.post("/conversations", verifyToken, getOrCreateConversation);
router.delete("/conversations/:conversationId", verifyToken, deleteConversation);
router.get("/messages/:conversationId", verifyToken, getMessages);
router.post("/messages", verifyToken, sendMessage);
router.put("/messages/:conversationId/read", verifyToken, markAsRead);
router.delete("/messages/:messageId", verifyToken, deleteMessage);

module.exports = router;
