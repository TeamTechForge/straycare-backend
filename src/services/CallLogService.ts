import CallLog from "../models/CallLog";
import { CallStatus } from "../enums/CallStatus.enum";
import { CallDirection } from "../enums/CallDirection.enum";
import { Logger as logger } from "../utils/Logger";
import { ICallLogDTO } from "../types/callLog";
import mongoose from "mongoose";

class CallLogService {
  /**
   * Create a new call log with RINGING status
   */
  public async createLog(callerId: string, receiverId: string): Promise<void> {
    try {
      await CallLog.create({
        caller: callerId,
        receiver: receiverId,
        status: CallStatus.RINGING,
        startedAt: new Date(),
      });
      logger.info(`[CallLogService] Created RINGING call log for caller: ${callerId}, receiver: ${receiverId}`);
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
        direction: isIncoming ? CallDirection.INCOMING : CallDirection.OUTGOING,
        startedAt: log.startedAt?.toISOString(),
        answeredAt: log.answeredAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
        duration: log.duration,
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
}

export default new CallLogService();
