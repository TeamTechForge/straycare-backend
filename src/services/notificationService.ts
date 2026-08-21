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

/** Regex pattern for validating Expo Push Tokens (e.g. ExponentPushToken[...] or ExpoPushToken[...]) */
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

/** Result status for push notification dispatch attempts */
type PushSendResult = "sent" | "invalid-token" | "failed";

/**
 * Sends a remote push notification to an Expo Push Token via HTTP POST to Expo's Push API.
 * 
 * @param pushToken - Expo Push Token registered by the target mobile device.
 * @param title - Notification title string.
 * @param message - Notification body text string.
 * @param data - Optional key-value payload attached to the push message.
 * @returns Status of the push delivery request: "sent", "invalid-token", or "failed".
 */
const sendPushNotification = async (
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<PushSendResult> => {
  // Validate token structure before making an external HTTP request
  if (!EXPO_PUSH_TOKEN_PATTERN.test(pushToken)) {
    Logger.warn("Skipping invalid Expo push token format", { service: "NotificationService" });
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
      Logger.error(`Expo push HTTP request failed with status: ${response.status}`, new Error("HTTP error"));
      return "failed";
    }

    type ExpoPushTicket = { status?: string; details?: { error?: string } };
    const payload = (await response.json()) as {
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
    Logger.error("Failed to send push notification HTTP request", error);
    return "failed";
  }
};

/**
 * Service for managing in-app notifications and pushing real-time alerts via Expo.
 */
export class NotificationService {
  /**
   * Safely creates and dispatches an in-app notification and remote push notification to a user.
   * First persists a Notification document in MongoDB, then attempts delivery via Expo Push API if pushToken exists.
   * Automatically strips invalid or unregistered push tokens upon failure.
   * 
   * @param userId - The MongoDB ObjectId string of the recipient user.
   * @param title - Short descriptive headline for the notification.
   * @param message - Detailed body text for the notification.
   * @param type - Notification category ("info" | "success" | "warning" | "error" | "welcome"). Defaults to "info".
   * @param rescueRequestId - Optional rescue request ID reference.
   * @param caseId - Optional public case ID reference.
   * @param pushData - Additional key-value metadata payload (e.g. event, status, animalType, assignedRescuerName, action).
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
    if (!userId || !mongoose.isValidObjectId(userId)) {
      Logger.warn(`Invalid or missing userId: ${userId}`, { service: "NotificationService" });
      return;
    }

    try {
      // 1. Create in-app Notification document in database
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

      // 2. Dispatch Expo Push Notification if recipient has a registered device pushToken
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
        Logger.error("Failed to process push notification dispatch", pushErr);
      }
    } catch (err: any) {
      Logger.error("Failed to create in-app notification document", err);
    }
  }
}

