// src/controllers/chatController.js
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Checks whether `senderId` is allowed to message `recipientId`
 * based on the recipient's messagingPrivacy setting.
 */
const canMessage = async (senderId, recipientId) => {
  const recipient = await User.findById(recipientId).select("messagingPrivacy").lean();
  if (!recipient) return { allowed: false, reason: "User not found" };

  switch (recipient.messagingPrivacy) {
    case "everyone":
      return { allowed: true };

    case "contacts": {
      // "contacts" = users who share at least one conversation already
      const existing = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
      }).lean();
      return existing
        ? { allowed: true }
        : { allowed: false, reason: "This user only accepts messages from existing contacts" };
    }

    case "relatedOnly": {
      // Allow if there's a conversation with a non-direct type (rescue, adoption, etc.)
      const related = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
        conversationType: { $ne: "direct" },
      }).lean();
      return related
        ? { allowed: true }
        : { allowed: false, reason: "This user only accepts messages from related interactions" };
    }

    case "none":
      return { allowed: false, reason: "This user has disabled messages" };

    default:
      return { allowed: true };
  }
};

const getChatNamespace = (req) => {
  const io = req.app.get("io");
  return io ? io.of("/chat") : null;
};

// ── GET /api/chat/conversations ─────────────────────────────────
// Lists all conversations for the authenticated user, sorted by latest activity.
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email role profileCompleted")
      .sort({ "lastMessage.createdAt": -1, updatedAt: -1 })
      .lean();

    return res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
};

// ── POST /api/chat/conversations ────────────────────────────────
// Finds an existing conversation between two users or creates a new one.
// Body: { participantId, conversationType?, relatedEntity? }
const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { participantId, conversationType, relatedEntity } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: "participantId is required" });
    }

    if (participantId === userId) {
      return res.status(400).json({ message: "Cannot start a conversation with yourself" });
    }

    // Privacy check
    const privacyResult = await canMessage(userId, participantId);
    if (!privacyResult.allowed) {
      return res.status(403).json({ message: privacyResult.reason });
    }

    // Check for existing conversation between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId], $size: 2 },
    })
      .populate("participants", "name email role profileCompleted")
      .lean();

    if (conversation) {
      return res.status(200).json(conversation);
    }

    // Create new conversation
    const newConversation = await Conversation.create({
      participants: [userId, participantId],
      conversationType: conversationType || "direct",
      relatedEntity: relatedEntity || undefined,
      unreadCounts: new Map(),
    });

    conversation = await Conversation.findById(newConversation._id)
      .populate("participants", "name email role profileCompleted")
      .lean();

    return res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

// ── GET /api/chat/messages/:conversationId ──────────────────────
// Paginated messages for a conversation (cursor-based, newest first).
// Query: ?before=<messageId>&limit=<number>
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { before, limit = 30 } = req.query;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const query = { conversationId };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("sender", "name")
      .lean();

    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

// ── POST /api/chat/messages ─────────────────────────────────────
// Sends a new message. Body: { conversationId, text?, type?, imageUrl?, imagePublicId?, location? }
const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      conversationId,
      text,
      type = "text",
      imageUrl,
      imagePublicId,
      location,
    } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Create the message
    const message = await Message.create({
      conversationId,
      sender: userId,
      text: text || "",
      type,
      imageUrl,
      imagePublicId,
      location,
      readBy: [userId], // sender has "read" their own message
    });

    // Update conversation's lastMessage snapshot
    const lastMessagePreview =
      type === "image" ? "📷 Photo" : type === "location" ? "📍 Location" : text || "";

    conversation.lastMessage = {
      text: lastMessagePreview,
      sender: userId,
      type,
      createdAt: message.createdAt,
    };

    // Increment unread count for all other participants
    for (const pid of conversation.participants) {
      const participantId = String(pid);
      if (participantId !== userId) {
        const current = conversation.unreadCounts.get(participantId) || 0;
        conversation.unreadCounts.set(participantId, current + 1);
      }
    }

    await conversation.save();

    // Populate sender info for the socket event
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name")
      .lean();

    // Emit real-time event to all participants in this conversation's room
    const chatNamespace = getChatNamespace(req);
    if (chatNamespace) {
      chatNamespace.to(conversationId).emit("message:new", {
        message: populatedMessage,
        conversationId,
      });
    }

    return res.status(201).json(populatedMessage);
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/chat/messages/:conversationId/read ─────────────────
// Marks all messages in a conversation as read by the authenticated user.
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Add userId to readBy for all unread messages in this conversation
    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Reset unread count for this user
    conversation.unreadCounts.set(userId, 0);
    await conversation.save();

    // Notify other participants via socket
    const chatNamespace = getChatNamespace(req);
    if (chatNamespace) {
      chatNamespace.to(conversationId).emit("message:read-ack", {
        conversationId,
        readBy: userId,
      });
    }

    return res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
};
