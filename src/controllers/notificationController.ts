import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const Notification = require("../models/Notification");

import type { Request, Response } from "express";

const getNotifications = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const notifications = await Notification.find({ userId: req.user!.id }).sort({
      createdAt: -1,
    });
    res.status(200).json(notifications);
});

const markAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.status(200).json({ message: "Notification marked as read" });
});

module.exports = {
  getNotifications,
  markAsRead,
};
