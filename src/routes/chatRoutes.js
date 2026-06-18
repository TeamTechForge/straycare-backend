// src/routes/chatRoutes.js
const express = require("express");
const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
} = require("../controllers/chatController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// All chat routes require authentication
router.get("/conversations", verifyToken, getConversations);
router.post("/conversations", verifyToken, getOrCreateConversation);
router.get("/messages/:conversationId", verifyToken, getMessages);
router.post("/messages", verifyToken, sendMessage);
router.put("/messages/:conversationId/read", verifyToken, markAsRead);

module.exports = router;
