"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const User = require("../models/User");
const RescueRequest = require("../models/RescueRequest");
const Conversation = require("../models/Conversation");
class PrivacyService {
    /**
     * Checks if two users share an active operational case (Rescue, Adoption, etc.)
     * or a non-direct conversation (which covers community interactions).
     */
    async isRelated(userA, userB) {
        // 1. Check if they have an active RescueRequest
        const activeRescue = await RescueRequest.findOne({
            status: { $in: ["pending", "accepted"] },
            $or: [
                { userId: userA, rescuerId: userB },
                { userId: userB, rescuerId: userA }
            ]
        }).lean();
        if (activeRescue)
            return true;
        // 2. Check if they have a non-direct conversation (e.g., adoption, vet_consult)
        const relatedConv = await Conversation.findOne({
            participants: { $all: [userA, userB] },
            conversationType: { $ne: "direct" }
        }).lean();
        if (relatedConv)
            return true;
        return false;
    }
    async canMessage(senderId, recipientId) {
        const recipient = await User.findById(recipientId).select("messagingPrivacy").lean();
        if (!recipient)
            return { allowed: false, reason: "User not found" };
        const privacy = recipient.messagingPrivacy || "everyone";
        if (privacy === "everyone")
            return { allowed: true };
        if (privacy === "contacts") {
            const existing = await Conversation.findOne({
                participants: { $all: [senderId, recipientId] }
            }).lean();
            if (existing)
                return { allowed: true };
            // Active cases OVERRIDE contacts restriction
            if (await this.isRelated(senderId, recipientId))
                return { allowed: true };
            return { allowed: false, reason: "This user only accepts messages from existing contacts" };
        }
        if (privacy === "relatedOnly") {
            if (await this.isRelated(senderId, recipientId))
                return { allowed: true };
            return { allowed: false, reason: "This user only accepts messages from people involved in their active cases" };
        }
        if (privacy === "none") {
            // OVERRIDE: Active Rescue/Adoption/Lost&Found cases ALWAYS override!
            if (await this.isRelated(senderId, recipientId))
                return { allowed: true };
            return { allowed: false, reason: "This user has disabled messages" };
        }
        return { allowed: true };
    }
    async canCall(callerId, receiverId) {
        const receiver = await User.findById(receiverId).select("callingPrivacy").lean();
        if (!receiver)
            return { allowed: false, reason: "User not found" };
        const privacy = receiver.callingPrivacy || "everyone";
        if (privacy === "everyone")
            return { allowed: true };
        if (privacy === "contacts") {
            const existing = await Conversation.findOne({
                participants: { $all: [callerId, receiverId] }
            }).lean();
            if (existing)
                return { allowed: true };
            // Active cases OVERRIDE contacts restriction
            if (await this.isRelated(callerId, receiverId))
                return { allowed: true };
            return { allowed: false, reason: "This user only accepts calls from existing contacts" };
        }
        if (privacy === "relatedOnly") {
            if (await this.isRelated(callerId, receiverId))
                return { allowed: true };
            return { allowed: false, reason: "This user only accepts calls from people involved in their active cases" };
        }
        if (privacy === "none") {
            // OVERRIDE: Active cases ALWAYS override!
            if (await this.isRelated(callerId, receiverId))
                return { allowed: true };
            return { allowed: false, reason: "This user has disabled calls" };
        }
        return { allowed: true };
    }
}
exports.default = new PrivacyService();
//# sourceMappingURL=PrivacyService.js.map