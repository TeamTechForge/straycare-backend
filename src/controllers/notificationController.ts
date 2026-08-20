import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";

// notificationController.ts
//
// Handles in-app notification retrieval and status updates.
// Automatically filters out notifications associated with cancelled rescue requests
// so obsolete or cancelled rescue alerts never confuse the user.

const Notification = require("../models/Notification");

/**
 * GET /api/notifications
 * 
 * Fetches all notifications belonging to the logged-in user.
 * It automatically checks for cancelled rescue requests and excludes them,
 * ensuring users do not see notifications for rescues that were cancelled.
 */
const getNotifications = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const RescueRequest = require("../models/RescueRequest");

    // Find all rescue requests that have been cancelled.
    const cancelled = await RescueRequest.find({ status: "cancelled" })
      .select("_id caseId")
      .lean();

    // Collect all cancelled MongoDB document IDs and custom case IDs.
    const cancelledIds: string[] = [];
    cancelled.forEach((r: any) => {
      if (r._id) cancelledIds.push(String(r._id));
      if (r.caseId) cancelledIds.push(String(r.caseId));
    });

    // Query notifications for the currently logged-in user.
    const query: any = { userId: req.user!.id };

    // If there are cancelled rescue cases, exclude their notifications.
    if (cancelledIds.length > 0) {
      query.rescueRequestId = { $nin: cancelledIds };
      query.caseId = { $nin: cancelledIds };
    }

    // Return the newest notifications first.
    const notifications = await Notification.find(query).sort({
      createdAt: -1,
    });

    res.status(200).json(notifications);
  }
);

/**
 * PATCH /api/notifications/:id/read
 * 
 * Marks a specific notification as read.
 */
const markAsRead = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    // Update the notification document's read field to true.
    await Notification.findByIdAndUpdate(id, { read: true });

    res.status(200).json({ message: "Notification marked as read" });
  }
);

module.exports = {
  getNotifications,
  markAsRead,
};

