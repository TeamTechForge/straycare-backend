import mongoose from "mongoose";
import { Logger } from "../utils/Logger";

const Notification = require("../models/Notification");

export class NotificationService {
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
    } catch (err: any) {
      Logger.error("Failed to create notification:", err);
    }
  }
}
