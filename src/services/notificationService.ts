import mongoose from "mongoose";
import { Logger } from "../utils/logger";

// notificationService.ts
//
// Central notification service for StrayCare.
// Responsible for:
// 1. Storing in-app notification records in MongoDB.
// 2. Dispatching push notifications to physical mobile devices via Expo Push Service.
// 3. Handling invalid/expired device tokens and automatic cleanup.

const Notification = require("../models/Notification");
const User = require("../models/User");

// Regex pattern to verify that a token is a valid Expo push token format
// Example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

type PushSendResult = "sent" | "invalid-token" | "failed";

/**
 * Sends a push notification to a user's mobile device using the Expo Push API.
 */
const sendPushNotification = async (
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<PushSendResult> => {
  // Validate token structure before making an external HTTP request
  if (!EXPO_PUSH_TOKEN_PATTERN.test(pushToken)) {
    Logger.warn("Skipping invalid Expo push token", { service: "NotificationService" });
    return "invalid-token";
  }

  try {
    const { categoryId, ...notificationData } = data || {};

    // POST request to Expo's push notification service
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
        channelId: "rescue-alerts", // Dedicated Android notification channel for rescue alerts
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

    // Check if Expo reported a delivery error
    if (ticket?.status === "error") {
      Logger.warn(`Expo rejected push notification: ${errorCode || "unknown error"}`, {
        service: "NotificationService",
      });
      // DeviceNotRegistered means app was uninstalled or token expired
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
   * Safely creates an in-app notification in MongoDB and sends a push notification to the user's device.
   * 
   * @param userId - MongoDB ObjectId of the recipient user.
   * @param title - Short title for the notification.
   * @param message - Detailed message body.
   * @param type - Notification type (info, success, warning, error, welcome).
   * @param rescueRequestId - Associated rescue request ID.
   * @param caseId - Associated case ID.
   * @param pushData - Additional metadata (event name, animalType, rescuer info, etc.)
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
      // 1. Create the persistent in-app notification in MongoDB
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

      // 2. Fetch the user to get their registered Expo push token
      try {
        const user = await User.findById(userId);
        if (!user) {
          Logger.warn(`Push recipient user not found: ${userId}`, { service: "NotificationService" });
        } else if (!user.pushToken) {
          Logger.warn(`No push token registered for user ${userId}`, { service: "NotificationService" });
        } else {
          // 3. Send the push notification to the device
          const result = await sendPushNotification(user.pushToken, title, message, {
            type,
            rescueRequestId,
            caseId,
            ...pushData,
          });

          // 4. If token is invalid or unregistered, clean it up from the database
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
}

