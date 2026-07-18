"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Logger_1 = require("../utils/Logger");
const Notification = require("../models/Notification");
class NotificationService {
    /**
     * Safely creates and dispatches an in-app notification to a user.
     * Internally catches and logs any database failures to prevent
     * non-critical notification errors from crashing primary business workflows.
     *
     * @param userId - The MongoDB ObjectId of the recipient user.
     * @param title - A short, descriptive title for the notification.
     * @param message - The detailed body text of the notification.
     * @param type - The severity/category of the notification. Defaults to "info".
     * @returns A promise that resolves when the operation is complete (or caught).
     */
    static async sendNotification(userId, title, message, type = "info", rescueRequestId = "", caseId = "") {
        if (!userId || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
            Logger_1.Logger.warn(`Invalid or missing userId: ${userId}`, { service: "NotificationService" });
            return;
        }
        try {
            await Notification.create({
                userId,
                title,
                message,
                type,
                rescueRequestId,
                caseId,
            });
            Logger_1.Logger.info(`Created '${type}' notification for user ${userId}: ${title}`, { service: "NotificationService" });
        }
        catch (err) {
            Logger_1.Logger.error("Failed to create notification:", err);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map