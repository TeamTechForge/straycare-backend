import mongoose from "mongoose";
import { Logger } from "../utils/Logger";

const Notification = require("../models/Notification");
const User = require("../models/User");

// Helper function to send push notifications via Expo Push Service
const sendPushNotification = async (
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
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
  } catch (error) {
    console.error("[PUSH] Failed to send push notification:", error);
  }
};

export class NotificationService {
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
  public static async sendNotification(
    userId: string, 
    title: string, 
    message: string, 
    type: "info" | "success" | "warning" | "error" | "welcome" = "info",
    rescueRequestId: string = "",
    caseId: string = ""
  ): Promise<void> {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      Logger.warn(`Invalid or missing userId: ${userId}`, { service: "NotificationService" });
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
      Logger.info(`Created '${type}' notification for user ${userId}: ${title}`, { service: "NotificationService" });

      // Send Expo Push Notification if recipient has registered a pushToken
      try {
        const user = await User.findById(userId);
        if (user && user.pushToken) {
          await sendPushNotification(user.pushToken, title, message, { rescueRequestId, caseId });
          Logger.info(`Sent Expo push notification to user ${userId}`, { service: "NotificationService" });
        }
      } catch (pushErr: any) {
        Logger.error("Failed to send push notification:", pushErr);
      }
    } catch (err: any) {
      Logger.error("Failed to create notification:", err);
    }
  }
}
