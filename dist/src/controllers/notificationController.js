"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const Notification = require("../models/Notification");
const getNotifications = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const notifications = await Notification.find({ userId: req.user.id }).sort({
        createdAt: -1,
    });
    res.status(200).json(notifications);
});
const markAsRead = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.status(200).json({ message: "Notification marked as read" });
});
module.exports = {
    getNotifications,
    markAsRead,
};
//# sourceMappingURL=notificationController.js.map