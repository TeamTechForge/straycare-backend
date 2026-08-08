const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

import type { Request, Response } from "express";

const Notification = require("../models/Notification");
const User = require("../models/User");

// GET all admin notifications

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

//POST create new admin notification

router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, audience, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const audienceRoles: string[] = Array.isArray(audience) ? audience : [];

    // Log the admin's broadcast for the "Previously Sent" history list
    const db = mongoose.connection.client.db("straycare");
    const newNotification = {
      title,
      audience: audienceRoles,
      message,
      createdAt: new Date(),
    };

    const result = await db.collection("admin_notifications").insertOne(newNotification);

    // Find every user who should receive this notification
    const userQuery = audienceRoles.length > 0 ? { role: { $in: audienceRoles } } : {};
    const targetUsers = await User.find(userQuery).select("_id");

    // Create one personal Notification document per matching user,
    // so it shows up in their existing Notifications screen on the mobile app.
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
