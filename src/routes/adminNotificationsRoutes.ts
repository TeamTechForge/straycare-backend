const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

import type { Request, Response } from "express";

const Notification = require("../models/Notification");
const User = require("../models/User");

// Every route in this file requires a verified administrator.
router.use(verifyToken, requireAdmin);

// Return previously sent dashboard announcements, newest first.
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const notifications = await db
      .collection("admin_notifications")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching admin notifications:", err);
    res.status(500).json({ error: "Failed to fetch admin notifications" });
  }
});

// Store an announcement and deliver it to the selected user roles.
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, audience, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const audienceRoles: string[] = Array.isArray(audience) ? audience : [];

    // Keep one dashboard record for the Previously Sent list.
    const db = mongoose.connection.client.db("straycare");
    const newNotification = {
      title,
      audience: audienceRoles,
      message,
      createdAt: new Date(),
    };

    const result = await db.collection("admin_notifications").insertOne(newNotification);

    // An empty audience means all user roles.
    const userQuery = audienceRoles.length > 0 ? { role: { $in: audienceRoles } } : {};
    const targetUsers = await User.find(userQuery).select("_id");

    // Create a personal notification for each matching mobile user.
    if (targetUsers.length > 0) {
      const notificationDocs = targetUsers.map((u: any) => ({
        userId: u._id,
        title,
        message,
        type: "info",
        read: false,
      }));

      await Notification.insertMany(notificationDocs);
    }

    res.json({
      ...newNotification,
      _id: result.insertedId,
      recipientCount: targetUsers.length,
    });
  } catch (err) {
    console.error("Error creating admin notification:", err);
    res.status(500).json({ error: "Failed to create admin notification" });
  }
});

module.exports = router;
