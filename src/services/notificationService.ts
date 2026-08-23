import mongoose from "mongoose";
import { Logger } from "../utils/logger";

const Notification = require("../models/Notification");
const User = require("../models/User");

// Helper function to send push notifications via Expo Push Service
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

type PushSendResult = "sent" | "invalid-token" | "failed";

const sendPushNotification = async (
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<PushSendResult> => {
  if (!EXPO_PUSH_TOKEN_PATTERN.test(pushToken)) {
    Logger.warn("Skipping invalid Expo push token", { service: "NotificationService" });
    return "invalid-token";
  }

  try {
    const { categoryId, ...notificationData } = data || {};
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
        priority: "high",
        channelId: "rescue-alerts",
        title,
        body: message,
        ...(typeof categoryId === "string" && categoryId ? { categoryId } : {}),
        data: notificationData,
      }),
    });

    if (!response.ok) {
      console.error("[PUSH] Expo push service error:", response.status);
      return "failed";
    }

    type ExpoPushTicket = { status?: string; details?: { error?: string } };
    const payload = await response.json() as {
      data?: ExpoPushTicket | ExpoPushTicket[];
    };
    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    const errorCode = ticket?.details?.error;

    if (ticket?.status === "error") {
      Logger.warn(`Expo rejected push notification: ${errorCode || "unknown error"}`, {
        service: "NotificationService",
      });
      return errorCode === "DeviceNotRegistered" ? "invalid-token" : "failed";
    }

    return ticket?.status === "ok" ? "sent" : "failed";
  } catch (error) {
    console.error("[PUSH] Failed to send push notification:", error);
    return "failed";
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
    caseId: string = "",
    pushData: Record<string, any> = {}
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
        event: typeof pushData.event === "string" ? pushData.event : "",
        status: typeof pushData.status === "string" ? pushData.status : "",
        animalType: typeof pushData.animalType === "string" ? pushData.animalType : "",
        assignedRescuerName: typeof pushData.assignedRescuerName === "string" ? pushData.assignedRescuerName : "",
        action: typeof pushData.action === "string" ? pushData.action : "",
      });
      Logger.info(`Created '${type}' notification for user ${userId}: ${title}`, { service: "NotificationService" });

      // Send Expo Push Notification if recipient has registered a pushToken
      try {
        const user = await User.findById(userId);
        if (!user) {
          Logger.warn(`Push recipient user not found: ${userId}`, { service: "NotificationService" });
        } else if (!user.pushToken) {
          // Keep the in-app notification, but make the missing device token
          // explicit so push-registration problems are diagnosable.
          Logger.warn(`No push token registered for user ${userId}`, { service: "NotificationService" });
        } else {
          const result = await sendPushNotification(user.pushToken, title, message, {
            type,
            rescueRequestId,
            caseId,
            ...pushData,
          });

          if (result === "invalid-token") {
            await User.findByIdAndUpdate(userId, { $unset: { pushToken: 1 } });
            Logger.warn(`Removed invalid Expo push token for user ${userId}`, { service: "NotificationService" });
          } else if (result === "sent") {
            Logger.info(`Sent Expo push notification to user ${userId}`, { service: "NotificationService" });
          } else {
            Logger.warn(`Expo push delivery was not confirmed for user ${userId}`, { service: "NotificationService" });
          }
        }
      } catch (pushErr: any) {
        Logger.error("Failed to send push notification:", pushErr);
      }
    } catch (err: any) {
      Logger.error("Failed to create notification:", err);
    }
  }

  /**
   * Sends a push notification without creating an in-app notification record.
   * Useful for chat messages where the chat itself is the record.
   */
  public static async sendPushOnly(
    userId: string,
    title: string,
    message: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;

    try {
      const user = await User.findById(userId);
      if (!user || !user.pushToken) {
        return;
      }

      const result = await sendPushNotification(user.pushToken, title, message, data);

      if (result === "invalid-token") {
        await User.findByIdAndUpdate(userId, { $unset: { pushToken: 1 } });
        Logger.warn(`Removed invalid Expo push token for user ${userId}`, { service: "NotificationService" });
      } else if (result === "sent") {
        Logger.info(`Sent Expo push-only notification to user ${userId}`, { service: "NotificationService" });
      }
    } catch (err: any) {
      Logger.error("Failed to send push-only notification:", err);
    }
  }
}
