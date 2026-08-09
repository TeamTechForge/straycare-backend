"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const callLogService_1 = __importDefault(require("../services/callLogService"));
const Logger_1 = require("../utils/Logger");
class CallLogController {
    constructor() {
        /**
         * Get authenticated user's call history
         */
        this.getHistory = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: "Unauthorized" });
                    return;
                }
                const history = await callLogService_1.default.getHistory(userId);
                res.status(200).json(history);
            }
            catch (error) {
                Logger_1.Logger.error("[CallLogController] Error fetching history", error);
                res.status(500).json({ message: "Internal server error" });
            }
        };
        /**
         * Delete a single call log
         */
        this.deleteLog = async (req, res) => {
            try {
                const userId = req.user?.id;
                const id = req.params.id;
                if (!userId) {
                    res.status(401).json({ message: "Unauthorized" });
                    return;
                }
                const success = await callLogService_1.default.deleteLog(id, userId);
                if (success) {
                    res.status(200).json({ message: "Log deleted successfully" });
                }
                else {
                    res.status(404).json({ message: "Log not found or unauthorized" });
                }
            }
            catch (error) {
                Logger_1.Logger.error("[CallLogController] Error deleting log", error);
                res.status(500).json({ message: "Internal server error" });
            }
        };
        /**
         * Clear all call history for the user
         */
        this.clearHistory = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: "Unauthorized" });
                    return;
                }
                await callLogService_1.default.clearHistory(userId);
                res.status(200).json({ message: "History cleared successfully" });
            }
            catch (error) {
                Logger_1.Logger.error("[CallLogController] Error clearing history", error);
                res.status(500).json({ message: "Internal server error" });
            }
        };
        /**
         * Mark all unseen missed calls as seen
         */
        this.markSeen = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: "Unauthorized" });
                    return;
                }
                await callLogService_1.default.markSeen(userId);
                res.status(200).json({ message: "Marked as seen" });
            }
            catch (error) {
                Logger_1.Logger.error("[CallLogController] Error marking as seen", error);
                res.status(500).json({ message: "Internal server error" });
            }
        };
    }
}
exports.default = new CallLogController();
//# sourceMappingURL=callLogController.js.map