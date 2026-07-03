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
  console.log(`[chatController Helpers] Checking privacy settings. Sender: ${senderId}, Recipient: ${recipientId}`);
  const recipient = await User.findById(recipientId).select("messagingPrivacy").lean();
  if (!recipient) {
    console.warn(`[chatController Helpers] Recipient user ${recipientId} not found`);
    return { allowed: false, reason: "User not found" };
  }

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

const getProfileImageForUser = async (uId, role) => {
  try {
    let profile = null;
    if (role === "general_user") {
      const GeneralUserProfile = require("../models/GeneralUserProfile");
      profile = await GeneralUserProfile.findOne({ userId: uId }).lean();
    } else if (role === "volunteer") {
      const VolunteerProfile = require("../models/VolunteerProfile");
      profile = await VolunteerProfile.findOne({ userId: uId }).lean();
    } else if (role === "ngo") {
      const NGOProfile = require("../models/NGOProfile");
      profile = await NGOProfile.findOne({ userId: uId }).lean();
    } else if (role === "vet") {
      const VetProfile = require("../models/VetProfile");
      profile = await VetProfile.findOne({ userId: uId }).lean();
    }
    return profile?.profileImage || "";
  } catch (err) {
    console.error(`Error in getProfileImageForUser helper:`, err);
    return "";
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
    console.log(`[chatController] 🔍 getConversations. User: ${userId}`);

    const conversations = await Conversation.find({
      participants: userId,
      deletedFor: { $ne: userId },
    })
      .populate("participants", "name email role profileCompleted profileImage")
      .sort({ "lastMessage.createdAt": -1, updatedAt: -1 })
      .lean();

    // Self-healing check
    for (let conv of conversations) {
      if (conv.participants) {
        for (let p of conv.participants) {
          if (p.profileImage === undefined || p.profileImage === null) {
            p.profileImage = await getProfileImageForUser(p._id, p.role);
            await User.findByIdAndUpdate(p._id, { profileImage: p.profileImage });
          }
        }
      }
    }

    console.log(`[chatController] ✅ Found ${conversations.length} conversations for User: ${userId}`);
    return res.status(200).json(conversations);
  } catch (error) {
    console.error(`[chatController] ❌ Error in getConversations: ${error.message}`);
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
    console.log(`[chatController] 🔍 getOrCreateConversation. User: ${userId}, Participant: ${participantId}`);

    if (!participantId) {
      return res.status(400).json({ message: "participantId is required" });
    }

    if (participantId === userId) {
      return res.status(400).json({ message: "Cannot start a conversation with yourself" });
    }

    // Privacy check
    const privacyResult = await canMessage(userId, participantId);
    if (!privacyResult.allowed) {
      console.warn(`[chatController] ❌ Privacy Blocked: ${privacyResult.reason}`);
      return res.status(403).json({ message: privacyResult.reason });
    }

    // Check for existing conversation between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId], $size: 2 },
    })
      .populate("participants", "name email role profileCompleted profileImage")
      .lean();

    if (conversation) {
      // Reactivate conversation if it was soft-deleted by user
      if (conversation.deletedFor && conversation.deletedFor.includes(userId)) {
        await Conversation.findByIdAndUpdate(conversation._id, { $pull: { deletedFor: userId } });
      }
      // Self-healing check
      if (conversation.participants) {
        for (let p of conversation.participants) {
          if (p.profileImage === undefined || p.profileImage === null) {
            p.profileImage = await getProfileImageForUser(p._id, p.role);
            await User.findByIdAndUpdate(p._id, { profileImage: p.profileImage });
          }
        }
      }
      console.log(`[chatController] ✅ Found existing conversation: ${conversation._id}`);
      return res.status(200).json(conversation);
    }

    // Create new conversation
    console.log(`[chatController] 🆕 Creating new conversation session. User: ${userId}, Participant: ${participantId}`);
    const newConversation = await Conversation.create({
      participants: [userId, participantId],
      conversationType: conversationType || "direct",
      relatedEntity: relatedEntity || undefined,
      unreadCounts: new Map(),
    });

    conversation = await Conversation.findById(newConversation._id)
      .populate("participants", "name email role profileCompleted profileImage")
      .lean();

    // Self-healing check
    if (conversation && conversation.participants) {
      for (let p of conversation.participants) {
        if (p.profileImage === undefined || p.profileImage === null) {
          p.profileImage = await getProfileImageForUser(p._id, p.role);
          await User.findByIdAndUpdate(p._id, { profileImage: p.profileImage });
        }
      }
    }

    console.log(`[chatController] ✅ Conversation created: ${conversation._id}`);
    return res.status(201).json(conversation);
  } catch (error) {
    console.error(`[chatController] ❌ Error in getOrCreateConversation: ${error.message}`);
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
    console.log(`[chatController] 🔍 getMessages. User: ${userId}, Conversation: ${conversationId}, Limit: ${limit}`);

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      console.warn(`[chatController] ❌ Conversation ${conversationId} not found or user is not a participant`);
      return res.status(404).json({ message: "Conversation not found" });
    }

    const query = { 
      conversationId,
      deletedFor: { $ne: userId }
    };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("sender", "name")
      .lean();

    const processedMessages = messages.map((msg) => {
      if (msg.isDeletedForEveryone) {
        return {
          _id: msg._id,
          conversationId: msg.conversationId,
          sender: msg.sender,
          type: "text",
          text: "This message was deleted.",
          readBy: msg.readBy,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          isDeletedForEveryone: true,
        };
      }
      return msg;
    });

    console.log(`[chatController] ✅ Found ${processedMessages.length} messages for Conversation: ${conversationId}`);
    return res.status(200).json(processedMessages);
  } catch (error) {
    console.error(`[chatController] ❌ Error in getMessages: ${error.message}`);
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
    console.log(`[chatController] ✉️ sendMessage. User: ${userId}, Conversation: ${conversationId}, Type: ${type}`);

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      console.warn(`[chatController] ❌ Conversation ${conversationId} not found or user is not a participant`);
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

    conversation.deletedFor = []; // Reactivate conversation for all participants when a new message is sent

    await conversation.save();
    console.log(`[chatController] ✅ Message ${message._id} saved and conversation snapshot updated`);

    // Populate sender info for the socket event
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name")
      .lean();

    // Emit real-time event to:
    // 1. The conversation room (for users who have this chat screen open)
    // 2. Each participant's personal room (for users on the chat list screen)
    const chatNamespace = getChatNamespace(req);
    if (chatNamespace) {
      const payload = {
        message: populatedMessage,
        conversationId,
      };

      // Emit to the conversation room
      chatNamespace.to(conversationId).emit("message:new", payload);

      // Also emit to each participant's personal room so their
      // conversation list can update even if they haven't joined
      // this specific conversation room.
      for (const pid of conversation.participants) {
        const participantId = String(pid);
        chatNamespace.to(`user:${participantId}`).emit("message:new", payload);
      }

      console.log(`[chatController] ✅ Emitted message:new to room ${conversationId} and ${conversation.participants.length} participant personal rooms`);
    }

    return res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(`[chatController] ❌ Error in sendMessage: ${error.message}`);
    next(error);
  }
};

// ── PUT /api/chat/messages/:conversationId/read ─────────────────
// Marks all messages in a conversation as read by the authenticated user.
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    console.log(`[chatController] 📖 markAsRead. User: ${userId}, Conversation: ${conversationId}`);

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      console.warn(`[chatController] ❌ Conversation ${conversationId} not found or user is not a participant`);
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Add userId to readBy for all unread messages in this conversation
    const updateResult = await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    // Reset unread count for this user
    conversation.unreadCounts.set(userId, 0);
    await conversation.save();
    console.log(`[chatController] ✅ Marked messages as read. Updated ${updateResult.modifiedCount} messages for user: ${userId}`);

    // Notify other participants via socket
    const chatNamespace = getChatNamespace(req);
    if (chatNamespace) {
      chatNamespace.to(conversationId).emit("message:read-ack", {
        conversationId,
        readBy: userId,
      });
      console.log(`[chatController] ✅ Emitted message:read-ack to room ${conversationId}`);
    }

    return res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.error(`[chatController] ❌ Error in markAsRead: ${error.message}`);
    next(error);
  }
};

// ── DELETE /api/chat/conversations/:conversationId ──────────────
// Soft deletes a conversation for the current user.
const deleteConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      { $addToSet: { deletedFor: userId } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found or access denied" });
    }

    console.log(`[chatController] 🗑️ Conversation ${conversationId} soft deleted for User: ${userId}`);
    return res.status(200).json({ message: "Conversation deleted successfully", conversationId });
  } catch (error) {
    console.error(`[chatController] ❌ Error in deleteConversation: ${error.message}`);
    next(error);
  }
};

// ── DELETE /api/chat/messages/:messageId ────────────────────────
// Deletes a message (Delete for Me or Delete for Everyone).
const deleteMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { type } = req.body; // "me" or "everyone"

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (type === "me") {
      // Add user to deletedFor array
      await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: userId } });
      console.log(`[chatController] 🗑️ Message ${messageId} deleted for user ${userId}`);
    } else if (type === "everyone") {
      // Verify that the sender is the one deleting for everyone
      if (message.sender.toString() !== userId) {
        return res.status(403).json({ message: "Cannot delete another user's message for everyone" });
      }

      message.isDeletedForEveryone = true;
      // Clear actual content for security/privacy
      message.text = "This message was deleted.";
      message.imageUrl = undefined;
      message.imagePublicId = undefined;
      message.location = undefined;
      message.type = "text";
      await message.save();

      // If this message was the lastMessage preview on the conversation, update it
      if (conversation.lastMessage && conversation.lastMessage.createdAt.getTime() === message.createdAt.getTime()) {
        conversation.lastMessage.text = "This message was deleted.";
        conversation.lastMessage.type = "text";
        await conversation.save();
      }

      console.log(`[chatController] 🗑️ Message ${messageId} deleted for everyone`);

      // Notify other participant via socket
      const chatNamespace = getChatNamespace(req);
      if (chatNamespace) {
        const payload = {
          messageId: message._id,
          conversationId: message.conversationId,
        };
        chatNamespace.to(message.conversationId.toString()).emit("message:delete", payload);
        for (const pid of conversation.participants) {
          chatNamespace.to(`user:${pid}`).emit("message:delete", payload);
        }
      }
    } else {
      return res.status(400).json({ message: "Invalid delete type" });
    }

    return res.status(200).json({ message: "Message deleted successfully", messageId });
  } catch (error) {
    console.error(`[chatController] ❌ Error in deleteMessage: ${error.message}`);
    next(error);
  }
};

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  deleteMessage,
};
