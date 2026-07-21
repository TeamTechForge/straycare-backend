"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Logger_1 = require("../utils/Logger");
const Notification = require("../models/Notification");
const User = require("../models/User");
// Helper function to send push notifications via Expo Push Service
const sendPushNotification = async (pushToken, title, message, data) => {
    try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: pushToken,
                sound: "default",
                title,
                body: message,
                data: data || {},
            }),
        });
        if (!response.ok) {
            console.error("[PUSH] Expo push service error:", response.status);
        }
    }
    catch (error) {
        console.error("[PUSH] Failed to send push notification:", error);
    }
};
class NotificationService {
    /**
     * Safely creates and dispatches an in-app notification and push notification to a user.
     *
     * @param userId - The MongoDB ObjectId of the recipient user.
     * @param title - A short, descriptive title for the notification.
     * @param message - The detailed body text of the notification.
     * @param type - The severity/category of the notification. Defaults to "info".
     * @param rescueRequestId - Optional rescue request ID.
     * @param caseId - Optional case ID.
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
            // Send Expo Push Notification if recipient has registered a pushToken
            try {
                const user = await User.findById(userId);
                if (user && user.pushToken) {
                    await sendPushNotification(user.pushToken, title, message, { rescueRequestId, caseId });
                    Logger_1.Logger.info(`Sent Expo push notification to user ${userId}`, { service: "NotificationService" });
                }
            }
            catch (pushErr) {
                Logger_1.Logger.error("Failed to send push notification:", pushErr);
            }
        }
        catch (err) {
            Logger_1.Logger.error("Failed to create notification:", err);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map