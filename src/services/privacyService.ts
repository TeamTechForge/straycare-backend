import type { Document } from "mongoose";

const User = require("../models/User");
const RescueRequest = require("../models/RescueRequest");
const Conversation = require("../models/Conversation");

class PrivacyService {
  /**
   * Checks if two users share an active operational case (Rescue, Adoption, etc.)
   * or a non-direct conversation (which covers community interactions).
   */
  public async isRelated(userA: string, userB: string): Promise<boolean> {
    // 1. Check if they have an active RescueRequest
    const activeRescue = await RescueRequest.findOne({
      status: { $in: ["pending", "accepted"] },
      $or: [
        { userId: userA, rescuerId: userB },
        { userId: userB, rescuerId: userA }
      ]
    }).lean();

    if (activeRescue) return true;

    // 2. Check if they have a non-direct conversation (e.g., adoption, vet_consult)
    const relatedConv = await Conversation.findOne({
      participants: { $all: [userA, userB] },
      conversationType: { $ne: "direct" }
    }).lean();

    if (relatedConv) return true;

    return false;
  }

  public async canMessage(senderId: string, recipientId: string): Promise<{ allowed: boolean; reason?: string }> {
    const recipient = await User.findById(recipientId).select("isDeleted messagingPrivacy blockedUsers").lean();
    const sender = await User.findById(senderId).select("blockedUsers").lean();

    if (!recipient || !sender) return { allowed: false, reason: "User not found" };

    // Deleted/anonymized accounts cannot receive new messages.
    // This covers adoption posts, lost & found posts, and direct chat initiation.
    if (recipient.isDeleted === true) {
      return { allowed: false, reason: "This account is no longer available." };
    }

    if (sender.blockedUsers && sender.blockedUsers.map((id: any) => id.toString()).includes(recipientId.toString())) {
      return { allowed: false, reason: "You have blocked this user" };
    }
    
    if (recipient.blockedUsers && recipient.blockedUsers.map((id: any) => id.toString()).includes(senderId.toString())) {
      return { allowed: false, reason: "You have been blocked by this user" };
    }

    const privacy = recipient.messagingPrivacy || "everyone";

    if (privacy === "everyone") return { allowed: true };

    if (privacy === "contacts") {
      const existing = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] }
      }).lean();
      if (existing) return { allowed: true };
      
      // Active cases OVERRIDE contacts restriction
      if (await this.isRelated(senderId, recipientId)) return { allowed: true };
      
      return { allowed: false, reason: "This user only accepts messages from existing contacts" };
    }

    if (privacy === "relatedOnly") {
      if (await this.isRelated(senderId, recipientId)) return { allowed: true };
      return { allowed: false, reason: "This user only accepts messages from people involved in their active cases" };
    }

    if (privacy === "none") {
      // OVERRIDE: Active Rescue/Adoption/Lost&Found cases ALWAYS override!
      if (await this.isRelated(senderId, recipientId)) return { allowed: true };
      return { allowed: false, reason: "This user has disabled messages" };
    }

    return { allowed: true };
  }

  public async canCall(callerId: string, receiverId: string): Promise<{ allowed: boolean; reason?: string }> {
    const receiver = await User.findById(receiverId).select("isDeleted callingPrivacy blockedUsers").lean();
    const caller = await User.findById(callerId).select("blockedUsers").lean();

    if (!receiver || !caller) return { allowed: false, reason: "User not found" };

    // Deleted/anonymized accounts cannot receive calls.
    // This covers adoption posts, lost & found posts, and direct call initiation.
    if (receiver.isDeleted === true) {
      return { allowed: false, reason: "This account is no longer available." };
    }

    if (caller.blockedUsers && caller.blockedUsers.map((id: any) => id.toString()).includes(receiverId.toString())) {
      return { allowed: false, reason: "You have blocked this user" };
    }
    
    if (receiver.blockedUsers && receiver.blockedUsers.map((id: any) => id.toString()).includes(callerId.toString())) {
      return { allowed: false, reason: "You have been blocked by this user" };
    }

    const privacy = receiver.callingPrivacy || "everyone";

    if (privacy === "everyone") return { allowed: true };

    if (privacy === "contacts") {
      const existing = await Conversation.findOne({
        participants: { $all: [callerId, receiverId] }
      }).lean();
      if (existing) return { allowed: true };
      
      // Active cases OVERRIDE contacts restriction
      if (await this.isRelated(callerId, receiverId)) return { allowed: true };
      
      return { allowed: false, reason: "This user only accepts calls from existing contacts" };
    }

    if (privacy === "relatedOnly") {
      if (await this.isRelated(callerId, receiverId)) return { allowed: true };
      return { allowed: false, reason: "This user only accepts calls from people involved in their active cases" };
    }

    if (privacy === "none") {
      // OVERRIDE: Active cases ALWAYS override!
      if (await this.isRelated(callerId, receiverId)) return { allowed: true };
      return { allowed: false, reason: "This user has disabled calls" };
    }

    return { allowed: true };
  }
}

export default new PrivacyService();
