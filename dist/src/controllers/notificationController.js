"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Notification = require("../models/Notification");
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id }).sort({
            createdAt: -1,
        });
        res.status(200).json(notifications);
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to fetch notifications",
            error: error.message,
        });
    }
};
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ message: "Notification marked as read" });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to mark notification as read",
            error: error.message,
        });
    }
};
module.exports = {
    getNotifications,
    markAsRead,
};
//# sourceMappingURL=notificationController.js.map