import { catchAsync } from "../utils/catchAsync";
// src/controllers/chatController.ts
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

import type { Request, Response, NextFunction } from "express";

import PrivacyService from "../services/privacyService";
import { encryptMessage, decryptMessage } from "../services/messageEncryptionService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { Role } from "../enums/Role.enum";

const profileModels: Record<string, any> = {
  [Role.GENERAL_USER]: require("../models/GeneralUserProfile"),
  [Role.VOLUNTEER]: require("../models/VolunteerProfile"),
  [Role.NGO]: require("../models/NGOProfile"),
  [Role.VET]: require("../models/VetProfile"),
};

const getProfileImageForUser = async (uId: string, role: string): Promise<string> => {
  try {
    const Model = profileModels[role];
    if (Model) {
      const profile = await Model.findOne({ userId: uId }).lean();
      return profile?.profileImage || "";
    }
    return "";
  } catch (err) {
    console.error(`Error in getProfileImageForUser helper:`, err);
    return "";
  }
};

const getChatNamespace = (req: Request): any => {
  const io = req.app.get("io");
  return io ? io.of("/chat") : null;
};

// ─── GET /api/chat/conversations ─────────────────────────────────────────────
// Lists all conversations for the authenticated user, sorted by latest activity.
const getConversations = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    console.log(`[chatController] 🔍 getConversations. User: ${userId}`);

    const conversations = await Conversation.find({
      participants: userId,
      deletedFor: { $ne: userId },
    })
      .populate("participants", "name email role profileCompleted profileImage avatar")
      .sort({ "lastMessage.createdAt": -1, updatedAt: -1 })
      .lean();

    // Self-healing check and inject shelter name for NGOs
    const NGOProfile = require("../models/NGOProfile");
    for (let conv of conversations) {
      if (conv.participants) {
        for (let p of conv.participants as any[]) {
          if (!p.profileImage) {
            p.profileImage = p.avatar || "";
          }
          if (p.role === "ngo") {
            const profile = await NGOProfile.findOne({ userId: p._id }).select("orgName").lean();
            if (profile && profile.orgName) {
              p.name = profile.orgName;
            }
          }
        }
      }

      if (conv.lastMessage?.isEncrypted && conv.lastMessage?.encryptedText) {
        try {
          conv.lastMessage.text = decryptMessage(conv.lastMessage.encryptedText);
        } catch (err) {
          console.error("Failed to decrypt lastMessage for conv:", conv._id, err);
          conv.lastMessage.text = "Error decrypting message";
        }
        delete conv.lastMessage.encryptedText;
      }
    }

    console.log(`[chatController] ✅ Found ${conversations.length} conversations for User: ${userId}`);
    res.status(200).json(conversations);
});

// ─── POST /api/chat/conversations ────────────────────────────────────────────
// Finds an existing conversation between two users or creates a new one.
// Body: { participantId, conversationType?, relatedEntity? }
const getOrCreateConversation = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const { participantId, conversationType, relatedEntity } = req.body;
    console.log(`[chatController] 🔍 getOrCreateConversation. User: ${userId}, Participant: ${participantId}`);

    if (!participantId) {
      res.status(400).json({ message: "participantId is required" });
      return;
    }

    if (participantId === userId) {
      res.status(400).json({ message: "Cannot start a conversation with yourself" });
      return;
    }

    // Evaluate permissions without failing the request (so the UI can render gracefully)
    const privacyResult = await PrivacyService.canMessage(userId, participantId);
    
    // Check for existing conversation between these two users
    let conversation: any = await Conversation.findOne({
      participants: { $all: [userId, participantId], $size: 2 },
    })
      .populate("participants", "name email role profileCompleted profileImage avatar")
      .lean();

    if (conversation) {
      // Reactivate conversation if it was soft-deleted by user
      if (conversation.deletedFor && conversation.deletedFor.includes(userId)) {
        await Conversation.findByIdAndUpdate(conversation._id, { $pull: { deletedFor: userId } });
      }
      // Self-healing check and inject shelter name for NGOs
      const NGOProfile = require("../models/NGOProfile");
      if (conversation.participants) {
        for (let p of conversation.participants) {
          if (!p.profileImage) {
            p.profileImage = p.avatar || "";
          }
          if (p.role === "ngo") {
            const profile = await NGOProfile.findOne({ userId: p._id }).select("orgName").lean();
            if (profile && profile.orgName) {
              p.name = profile.orgName;
            }
          }
        }
      }

      if (conversation.lastMessage?.isEncrypted && conversation.lastMessage?.encryptedText) {
        try {
          conversation.lastMessage.text = decryptMessage(conversation.lastMessage.encryptedText);
        } catch (err) {
          console.error("Failed to decrypt lastMessage for conv:", conversation._id, err);
          conversation.lastMessage.text = "Error decrypting message";
        }
        delete conversation.lastMessage.encryptedText;
      }

      console.log(`[chatController] ✅ Found existing conversation: ${conversation._id}`);
      res.status(200).json({
        ...conversation,
        permissions: { canMessage: privacyResult.allowed }
      });
      return;
    }

    // If no existing conversation AND privacy prevents messaging, we don't block creating it,
    // but the UI will disable sending messages. This allows users to open chat and see "not accepting messages".
    
    // Create new conversation
    console.log(`[chatController] 🆕 Creating new conversation session. User: ${userId}, Participant: ${participantId}`);
    const newConversation = await Conversation.create({
      participants: [userId, participantId],
      conversationType: conversationType || "direct",
      relatedEntity: relatedEntity || undefined,
      unreadCounts: new Map(),
    });

    conversation = await Conversation.findById(newConversation._id)
      .populate("participants", "name email role profileCompleted profileImage avatar")
      .lean();

    // Self-healing check and inject shelter name for NGOs
    const NGOProfile = require("../models/NGOProfile");
    if (conversation && conversation.participants) {
      for (let p of conversation.participants) {
        if (!p.profileImage) {
          p.profileImage = p.avatar || "";
        }
        if (p.role === "ngo") {
          const profile = await NGOProfile.findOne({ userId: p._id }).select("orgName").lean();
          if (profile && profile.orgName) {
            p.name = profile.orgName;
          }
        }
      }
    }

    console.log(`[chatController] ✅ Conversation created: ${conversation._id}`);
    res.status(201).json({
      ...conversation,
      permissions: { canMessage: privacyResult.allowed }
    });
});

// ─── GET /api/chat/messages/:conversationId ──────────────────────────────────
// Paginated messages for a conversation (cursor-based, newest first).
// Query: ?before=<messageId>&limit=<number>
const getMessages = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
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
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    const query: any = { 
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

    const processedMessages = messages.map((msg: any) => {
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
      if (msg.isEncrypted) {
        if (msg.encryptedText) {
          try {
            msg.text = decryptMessage(msg.encryptedText);
          } catch (err) {
            console.error("Failed to decrypt message text:", msg._id, err);
            msg.text = "Error decrypting message";
          }
          delete msg.encryptedText;
        }
        if (msg.encryptedImageUrl) {
          try {
            msg.imageUrl = decryptMessage(msg.encryptedImageUrl);
          } catch (err) {
            console.error("Failed to decrypt imageUrl:", msg._id, err);
          }
          delete msg.encryptedImageUrl;
        }
        if (msg.encryptedLocation) {
          try {
            msg.location = JSON.parse(decryptMessage(msg.encryptedLocation));
          } catch (err) {
            console.error("Failed to decrypt location:", msg._id, err);
          }
          delete msg.encryptedLocation;
        }
      }
      return msg;
    });

    console.log(`[chatController] ✅ Found ${processedMessages.length} messages for Conversation: ${conversationId}`);
    res.status(200).json(processedMessages);
});

// ─── POST /api/chat/messages ─────────────────────────────────────────────────
// Sends a new message. Body: { conversationId, text?, type?, imageUrl?, imagePublicId?, location? }
const sendMessage = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const {
      conversationId,
      text,
      type = "text",
      imageUrl,
      imagePublicId,
      location,
    } = req.body;
    console.log(`[chatController] ✈️ sendMessage. User: ${userId}, Conversation: ${conversationId}, Type: ${type}`);

    if (!conversationId) {
      res.status(400).json({ message: "conversationId is required" });
      return;
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      console.warn(`[chatController] ❌ Conversation ${conversationId} not found or user is not a participant`);
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    // Enforce privacy strictness on actual sending
    const otherParticipantId = conversation.participants.find((p: any) => p.toString() !== userId);
    if (otherParticipantId) {
      const privacyResult = await PrivacyService.canMessage(userId, otherParticipantId.toString());
      if (!privacyResult.allowed) {
        console.warn(`[chatController] ❌ Message Blocked by Privacy: ${privacyResult.reason}`);
        res.status(403).json({ message: privacyResult.reason });
        return;
      }
    }

    let finalPayloadText = text || "";
    let isEncrypted = false;
    let encryptedText = undefined;
    
    if (finalPayloadText.trim().length > 0) {
      isEncrypted = true;
      encryptedText = encryptMessage(finalPayloadText);
      finalPayloadText = ""; // don't save plaintext to DB
    }

    let finalImageUrl = imageUrl;
    let encryptedImageUrl = undefined;
    if (finalImageUrl) {
      isEncrypted = true;
      encryptedImageUrl = encryptMessage(finalImageUrl);
      finalImageUrl = "";
    }

    let finalLocation = location;
    let encryptedLocation = undefined;
    if (finalLocation) {
      isEncrypted = true;
      encryptedLocation = encryptMessage(JSON.stringify(finalLocation));
      finalLocation = undefined;
    }

    // Create the message
    const message = await Message.create({
      conversationId,
      sender: userId,
      text: finalPayloadText,
      type,
      imageUrl: finalImageUrl,
      imagePublicId,
      location: finalLocation,
      readBy: [userId], // sender has "read" their own message
      isEncrypted,
      encryptedText,
      encryptedImageUrl,
      encryptedLocation,
    });

    // Update conversation's lastMessage snapshot
    const lastMessagePreview =
      type === "image" ? "📷 Photo" : type === "location" ? "📍 Location" : text || "";

    let lastMessageIsEncrypted = false;
    let lastMessageEncryptedText = undefined;
    let finalLastMessageText = lastMessagePreview;

    if (finalLastMessageText.trim().length > 0) {
       lastMessageIsEncrypted = true;
       lastMessageEncryptedText = encryptMessage(finalLastMessageText);
       finalLastMessageText = "";
    }

    conversation.lastMessage = {
      text: finalLastMessageText,
      isEncrypted: lastMessageIsEncrypted,
      encryptedText: lastMessageEncryptedText,
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
    console.log(`[chatController] âœ… Message ${message._id} saved and conversation snapshot updated`);

    // Populate sender info for the socket event
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name")
      .lean();

    if (populatedMessage && populatedMessage.isEncrypted) {
      if (populatedMessage.encryptedText) {
        try {
          populatedMessage.text = decryptMessage(populatedMessage.encryptedText);
        } catch (err) {
          console.error("Failed to decrypt text for socket payload:", populatedMessage._id, err);
          populatedMessage.text = "Error decrypting message";
        }
        delete populatedMessage.encryptedText;
      }
      if (populatedMessage.encryptedImageUrl) {
        try {
          populatedMessage.imageUrl = decryptMessage(populatedMessage.encryptedImageUrl);
        } catch (err) {
          console.error("Failed to decrypt imageUrl for socket payload:", populatedMessage._id, err);
        }
        delete populatedMessage.encryptedImageUrl;
      }
      if (populatedMessage.encryptedLocation) {
        try {
          populatedMessage.location = JSON.parse(decryptMessage(populatedMessage.encryptedLocation));
        } catch (err) {
          console.error("Failed to decrypt location for socket payload:", populatedMessage._id, err);
        }
        delete populatedMessage.encryptedLocation;
      }
    }

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

      console.log(`[chatController] âœ… Emitted message:new to room ${conversationId} and ${conversation.participants.length} participant personal rooms`);
    }

    res.status(201).json(populatedMessage);
});

// â”€â”€ PUT /api/chat/messages/:conversationId/read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Marks all messages in a conversation as read by the authenticated user.
const markAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const { conversationId } = req.params;
    console.log(`[chatController] ðŸ“– markAsRead. User: ${userId}, Conversation: ${conversationId}`);

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      console.warn(`[chatController] âŒ Conversation ${conversationId} not found or user is not a participant`);
      res.status(404).json({ message: "Conversation not found" });
      return;
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
    console.log(`[chatController] âœ… Marked messages as read. Updated ${updateResult.modifiedCount} messages for user: ${userId}`);

    // Notify other participants via socket
    const chatNamespace = getChatNamespace(req);
    if (chatNamespace) {
      chatNamespace.to(conversationId).emit("message:read-ack", {
        conversationId,
        readBy: userId,
      });
      console.log(`[chatController] âœ… Emitted message:read-ack to room ${conversationId}`);
    }

    res.status(200).json({ message: "Messages marked as read" });
});

// â”€â”€ DELETE /api/chat/conversations/:conversationId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Soft deletes a conversation for the current user.
const deleteConversation = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      { $addToSet: { deletedFor: userId } },
      { new: true }
    );

    if (!conversation) {
      res.status(404).json({ message: "Conversation not found or access denied" });
      return;
    }

    console.log(`[chatController] ðŸ—‘ï¸ Conversation ${conversationId} soft deleted for User: ${userId}`);
    res.status(200).json({ message: "Conversation deleted successfully", conversationId });
});

// â”€â”€ DELETE /api/chat/messages/:messageId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Deletes a message (Delete for Me or Delete for Everyone).
const deleteMessage = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const { messageId } = req.params;
    const { type } = req.body; // "me" or "everyone"

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId,
    });
    if (!conversation) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    if (type === "me") {
      // Add user to deletedFor array
      await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: userId } });
      console.log(`[chatController] ðŸ—‘ï¸ Message ${messageId} deleted for user ${userId}`);
    } else if (type === "everyone") {
      // Verify that the sender is the one deleting for everyone
      if (message.sender.toString() !== userId) {
        res.status(403).json({ message: "Cannot delete another user's message for everyone" });
        return;
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

      console.log(`[chatController] ðŸ—‘ï¸ Message ${messageId} deleted for everyone`);

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
      res.status(400).json({ message: "Invalid delete type" });
      return;
    }

    res.status(200).json({ message: "Message deleted successfully", messageId });
});

module.exports = {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  deleteMessage,
};
