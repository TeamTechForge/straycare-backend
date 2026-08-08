"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CallLog_1 = __importDefault(require("../models/CallLog"));
const CallStatus_enum_1 = require("../enums/CallStatus.enum");
const CallDirection_enum_1 = require("../enums/CallDirection.enum");
const Logger_1 = require("../utils/Logger");
const mongoose_1 = __importDefault(require("mongoose"));
class CallLogService {
    /**
     * Create a new call log with RINGING status
     */
    async createLog(callerId, receiverId, status = CallStatus_enum_1.CallStatus.RINGING) {
        try {
            await CallLog_1.default.create({
                caller: callerId,
                receiver: receiverId,
                status: status,
                startedAt: new Date(),
                isSeen: false,
            });
            Logger_1.Logger.info(`[CallLogService] Created ${status} call log for caller: ${callerId}, receiver: ${receiverId}`);
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to create call log`, error);
        }
    }
    /**
     * Find any active call (RINGING or ANSWERED) for a specific user
     */
    async findActiveCall(userId) {
        try {
            return await CallLog_1.default.findOne({
                $or: [{ caller: userId }, { receiver: userId }],
                status: { $in: [CallStatus_enum_1.CallStatus.RINGING, CallStatus_enum_1.CallStatus.ANSWERED] }
            }).sort({ createdAt: -1 });
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to find active call for user ${userId}`, error);
            return null;
        }
    }
    /**
     * Mark the most recent RINGING call between these users as ANSWERED
     */
    async markAnswered(callerId, receiverId) {
        try {
            const log = await CallLog_1.default.findOne({ caller: callerId, receiver: receiverId, status: CallStatus_enum_1.CallStatus.RINGING }).sort({ createdAt: -1 });
            if (log) {
                log.status = CallStatus_enum_1.CallStatus.ANSWERED;
                log.answeredAt = new Date();
                await log.save();
                Logger_1.Logger.info(`[CallLogService] Marked call log as ANSWERED for caller: ${callerId}`);
            }
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to mark call answered`, error);
        }
    }
    /**
     * Mark the most recent RINGING call as REJECTED
     */
    async markRejected(callerId, receiverId) {
        try {
            const log = await CallLog_1.default.findOne({ caller: callerId, receiver: receiverId, status: CallStatus_enum_1.CallStatus.RINGING }).sort({ createdAt: -1 });
            if (log) {
                log.status = CallStatus_enum_1.CallStatus.REJECTED;
                log.endedAt = new Date();
                await log.save();
                Logger_1.Logger.info(`[CallLogService] Marked call log as REJECTED for caller: ${callerId}`);
            }
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to mark call rejected`, error);
        }
    }
    /**
     * Complete the call (from ANSWERED or RINGING)
     */
    async completeCall(callerId, receiverId) {
        try {
            // Find the most recent active call
            const log = await CallLog_1.default.findOne({
                caller: callerId,
                receiver: receiverId,
                status: { $in: [CallStatus_enum_1.CallStatus.RINGING, CallStatus_enum_1.CallStatus.ANSWERED] }
            }).sort({ createdAt: -1 });
            if (log) {
                const now = new Date();
                log.endedAt = now;
                if (log.status === CallStatus_enum_1.CallStatus.RINGING) {
                    // If it was still ringing when ended by caller, it's a MISSED call for the receiver
                    log.status = CallStatus_enum_1.CallStatus.MISSED;
                }
                else {
                    // If it was answered, it's ended. Calculate duration.
                    log.status = CallStatus_enum_1.CallStatus.ENDED;
                    if (log.answeredAt) {
                        log.duration = Math.floor((now.getTime() - log.answeredAt.getTime()) / 1000);
                    }
                }
                await log.save();
                Logger_1.Logger.info(`[CallLogService] Completed call log with status ${log.status}`);
            }
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to complete call`, error);
        }
    }
    /**
     * Get history for a specific user
     */
    async getHistory(userId) {
        const logs = await CallLog_1.default.find({
            $or: [{ caller: userId }, { receiver: userId }]
        })
            .sort({ createdAt: -1 })
            .populate("caller", "name profileImage")
            .populate("receiver", "name profileImage")
            .lean();
        return logs.map((log) => {
            const isIncoming = log.receiver._id.toString() === userId;
            return {
                _id: log._id.toString(),
                caller: {
                    userId: log.caller._id.toString(),
                    name: log.caller.name,
                    profileImage: log.caller.profileImage,
                },
                receiver: {
                    userId: log.receiver._id.toString(),
                    name: log.receiver.name,
                    profileImage: log.receiver.profileImage,
                },
                status: log.status,
                direction: isIncoming ? CallDirection_enum_1.CallDirection.INCOMING : CallDirection_enum_1.CallDirection.OUTGOING,
                startedAt: log.startedAt?.toISOString(),
                answeredAt: log.answeredAt?.toISOString(),
                endedAt: log.endedAt?.toISOString(),
                duration: log.duration,
                isSeen: log.isSeen,
                createdAt: log.createdAt.toISOString(),
            };
        });
    }
    async deleteLog(logId, userId) {
        const result = await CallLog_1.default.deleteOne({
            _id: logId,
            $or: [{ caller: userId }, { receiver: userId }]
        });
        return result.deletedCount === 1;
    }
    async clearHistory(userId) {
        await CallLog_1.default.deleteMany({
            $or: [{ caller: userId }, { receiver: userId }]
        });
    }
    /**
     * Mark all missed calls as seen for a user
     */
    async markSeen(userId) {
        try {
            await CallLog_1.default.updateMany({ receiver: new mongoose_1.default.Types.ObjectId(userId), status: CallStatus_enum_1.CallStatus.MISSED, isSeen: { $ne: true } }, { $set: { isSeen: true } });
        }
        catch (error) {
            Logger_1.Logger.error(`[CallLogService] Failed to mark calls as seen`, error);
            throw error;
        }
    }
}
exports.default = new CallLogService();
//# sourceMappingURL=CallLogService.js.map