import CallLog from "../models/CallLog";
import { CallStatus } from "../enums/CallStatus.enum";
import { CallDirection } from "../enums/CallDirection.enum";
import { Logger as logger } from "../utils/logger";
import { ICallLogDTO } from "../types/callLog";
import mongoose from "mongoose";

class CallLogService {
  /**
   * Create a new call log with RINGING status
   */
  public async createLog(callerId: string, receiverId: string, status: CallStatus = CallStatus.RINGING, callerOverride?: string, receiverOverride?: string): Promise<void> {
    try {
      await CallLog.create({
        caller: callerId,
        receiver: receiverId,
        status: status,
        startedAt: new Date(),
        isSeen: false,
        callerNameOverride: callerOverride,
        receiverNameOverride: receiverOverride,
      });
      logger.info(`[CallLogService] Created ${status} call log for caller: ${callerId}, receiver: ${receiverId}`);
    } catch (error) {
      logger.error(`[CallLogService] Failed to create call log`, error);
    }
  }

  /**
   * Find any active call (RINGING or ANSWERED) for a specific user
   */
  public async findActiveCall(userId: string) {
    try {
      return await CallLog.findOne({
        $or: [{ caller: userId }, { receiver: userId }],
        status: { $in: [CallStatus.RINGING, CallStatus.ANSWERED] }
      }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`[CallLogService] Failed to find active call for user ${userId}`, error);
      return null;
    }
  }

  /**
   * Mark the most recent RINGING call between these users as ANSWERED
   */
  public async markAnswered(callerId: string, receiverId: string): Promise<void> {
    try {
      const log = await CallLog.findOne({ caller: callerId, receiver: receiverId, status: CallStatus.RINGING }).sort({ createdAt: -1 });
      if (log) {
        log.status = CallStatus.ANSWERED;
        log.answeredAt = new Date();
        await log.save();
        logger.info(`[CallLogService] Marked call log as ANSWERED for caller: ${callerId}`);
      }
    } catch (error) {
      logger.error(`[CallLogService] Failed to mark call answered`, error);
    }
  }

  /**
   * Mark the most recent RINGING call as REJECTED
   */
  public async markRejected(callerId: string, receiverId: string): Promise<void> {
    try {
      const log = await CallLog.findOne({ caller: callerId, receiver: receiverId, status: CallStatus.RINGING }).sort({ createdAt: -1 });
      if (log) {
        log.status = CallStatus.REJECTED;
        log.endedAt = new Date();
        await log.save();
        logger.info(`[CallLogService] Marked call log as REJECTED for caller: ${callerId}`);
      }
    } catch (error) {
      logger.error(`[CallLogService] Failed to mark call rejected`, error);
    }
  }

  /**
   * Complete the call (from ANSWERED or RINGING)
   */
  public async completeCall(callerId: string, receiverId: string): Promise<void> {
    try {
      // Find the most recent active call
      const log = await CallLog.findOne({
        caller: callerId,
        receiver: receiverId,
        status: { $in: [CallStatus.RINGING, CallStatus.ANSWERED] }
      }).sort({ createdAt: -1 });

      if (log) {
        const now = new Date();
        log.endedAt = now;
        
        if (log.status === CallStatus.RINGING) {
          // If it was still ringing when ended by caller, it's a MISSED call for the receiver
          log.status = CallStatus.MISSED;
        } else {
          // If it was answered, it's ended. Calculate duration.
          log.status = CallStatus.ENDED;
          if (log.answeredAt) {
            log.duration = Math.floor((now.getTime() - log.answeredAt.getTime()) / 1000);
          }
        }
        await log.save();
        logger.info(`[CallLogService] Completed call log with status ${log.status}`);
      }
    } catch (error) {
      logger.error(`[CallLogService] Failed to complete call`, error);
    }
  }

  /**
   * Get history for a specific user
   */
  public async getHistory(userId: string): Promise<ICallLogDTO[]> {
    const logs = await CallLog.find({
      $or: [{ caller: userId }, { receiver: userId }]
    })
    .sort({ createdAt: -1 })
    .populate("caller", "name profileImage")
    .populate("receiver", "name profileImage")
    .lean();

    return logs.map((log: any) => {
      // Safely handle cases where the user was deleted (populate returns null)
      const receiverId = log.receiver?._id ? log.receiver._id.toString() : log.receiver?.toString() || "unknown";
      const callerId = log.caller?._id ? log.caller._id.toString() : log.caller?.toString() || "unknown";

      const isIncoming = receiverId === userId;
      
      return {
        _id: log._id.toString(),
        caller: {
          userId: callerId,
          name: log.callerNameOverride || log.caller?.name || "Deleted User",
          profileImage: log.callerNameOverride ? "https://ui-avatars.com/api/?name=Case+Chat&background=FEB94B&color=fff" : (log.caller?.profileImage || ""),
        },
        receiver: {
          userId: receiverId,
          name: log.receiverNameOverride || log.receiver?.name || "Deleted User",
          profileImage: log.receiverNameOverride ? "https://ui-avatars.com/api/?name=Case+Chat&background=FEB94B&color=fff" : (log.receiver?.profileImage || ""),
        },
        status: log.status,
        direction: isIncoming ? CallDirection.INCOMING : CallDirection.OUTGOING,
        startedAt: log.startedAt?.toISOString(),
        answeredAt: log.answeredAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
        duration: log.duration,
        isSeen: log.isSeen,
        createdAt: log.createdAt.toISOString(),
      };
    });
  }

  public async deleteLog(logId: string, userId: string): Promise<boolean> {
    const result = await CallLog.deleteOne({
      _id: logId,
      $or: [{ caller: userId }, { receiver: userId }]
    });
    return result.deletedCount === 1;
  }

  public async clearHistory(userId: string): Promise<void> {
    await CallLog.deleteMany({
      $or: [{ caller: userId }, { receiver: userId }]
    });
  }

  /**
   * Mark all missed calls as seen for a user
   */
  public async markSeen(userId: string): Promise<void> {
    try {
      await CallLog.updateMany(
        { receiver: new mongoose.Types.ObjectId(userId), status: CallStatus.MISSED, isSeen: { $ne: true } },
        { $set: { isSeen: true } }
      );
    } catch (error) {
      logger.error(`[CallLogService] Failed to mark calls as seen`, error);
      throw error;
    }
  }
}

export default new CallLogService();
