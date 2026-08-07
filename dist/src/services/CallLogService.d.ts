import { CallStatus } from "../enums/CallStatus.enum";
import { ICallLogDTO } from "../types/callLog";
import mongoose from "mongoose";
declare class CallLogService {
    /**
     * Create a new call log with RINGING status
     */
    createLog(callerId: string, receiverId: string, status?: CallStatus): Promise<void>;
    /**
     * Find any active call (RINGING or ANSWERED) for a specific user
     */
    findActiveCall(userId: string): Promise<(mongoose.Document<unknown, {}, import("../models/CallLog").ICallLog, {}, mongoose.DefaultSchemaOptions> & import("../models/CallLog").ICallLog & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    /**
     * Mark the most recent RINGING call between these users as ANSWERED
     */
    markAnswered(callerId: string, receiverId: string): Promise<void>;
    /**
     * Mark the most recent RINGING call as REJECTED
     */
    markRejected(callerId: string, receiverId: string): Promise<void>;
    /**
     * Complete the call (from ANSWERED or RINGING)
     */
    completeCall(callerId: string, receiverId: string): Promise<void>;
    /**
     * Get history for a specific user
     */
    getHistory(userId: string): Promise<ICallLogDTO[]>;
    deleteLog(logId: string, userId: string): Promise<boolean>;
    clearHistory(userId: string): Promise<void>;
    /**
     * Mark all missed calls as seen for a user
     */
    markSeen(userId: string): Promise<void>;
}
declare const _default: CallLogService;
export default _default;
//# sourceMappingURL=callLogService.d.ts.map