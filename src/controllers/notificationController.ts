import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const Notification = require("../models/Notification");

import type { Request, Response } from "express";

const getNotifications = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const RescueRequest = require("../models/RescueRequest");
    const cancelled = await RescueRequest.find({ status: "cancelled" }).select("_id caseId").lean();
    const cancelledIds: string[] = [];
    cancelled.forEach((r: any) => {
      if (r._id) cancelledIds.push(String(r._id));
      if (r.caseId) cancelledIds.push(String(r.caseId));
    });

    const query: any = { userId: req.user!.id };
    if (cancelledIds.length > 0) {
      query.rescueRequestId = { $nin: cancelledIds };
      query.caseId = { $nin: cancelledIds };
    }

    const notifications = await Notification.find(query).sort({
      createdAt: -1,
    });
    res.status(200).json(notifications);
});

const markAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true });
    res.status(200).json({ message: "Notification marked as read" });
});

module.exports = {
  getNotifications,
  markAsRead,
};
