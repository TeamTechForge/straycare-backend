import { Request, Response } from "express";
import CallLogService from "../services/callLogService";
import { Logger as logger } from "../utils/Logger";

class CallLogController {
  /**
   * Get authenticated user's call history
   */
  public getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const history = await CallLogService.getHistory(userId);
      res.status(200).json(history);
    } catch (error: any) {
      logger.error("[CallLogController] Error fetching history", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  /**
   * Delete a single call log
   */
  public deleteLog = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const id = req.params.id as string;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const success = await CallLogService.deleteLog(id, userId);
      if (success) {
        res.status(200).json({ message: "Log deleted successfully" });
      } else {
        res.status(404).json({ message: "Log not found or unauthorized" });
      }
    } catch (error: any) {
      logger.error("[CallLogController] Error deleting log", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  /**
   * Clear all call history for the user
   */
  public clearHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      await CallLogService.clearHistory(userId);
      res.status(200).json({ message: "History cleared successfully" });
    } catch (error: any) {
      logger.error("[CallLogController] Error clearing history", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  /**
   * Mark all unseen missed calls as seen
   */
  public markSeen = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      await CallLogService.markSeen(userId);
      res.status(200).json({ message: "Marked as seen" });
    } catch (error: any) {
      logger.error("[CallLogController] Error marking as seen", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export default new CallLogController();
