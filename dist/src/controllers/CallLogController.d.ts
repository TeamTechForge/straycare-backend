import { Request, Response } from "express";
declare class CallLogController {
    /**
     * Get authenticated user's call history
     */
    getHistory: (req: Request, res: Response) => Promise<void>;
    /**
     * Delete a single call log
     */
    deleteLog: (req: Request, res: Response) => Promise<void>;
    /**
     * Clear all call history for the user
     */
    clearHistory: (req: Request, res: Response) => Promise<void>;
    /**
     * Mark all unseen missed calls as seen
     */
    markSeen: (req: Request, res: Response) => Promise<void>;
}
declare const _default: CallLogController;
export default _default;
//# sourceMappingURL=CallLogController.d.ts.map