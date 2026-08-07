"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
// GET all admin notifications
router.get("/", async (req, res) => {
    try {
        const db = mongoose.connection.client.db("straycare");
        const notifications = await db
            .collection("admin_notifications")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        res.json(notifications);
    }
    catch (err) {
        console.error("Error fetching admin notifications:", err);
        res.status(500).json({ error: "Failed to fetch admin notifications" });
    }
});
//POST create new admin notification
router.post("/", async (req, res) => {
    try {
        const { title, audience, message } = req.body;
        if (!title || !audience || !message) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const db = mongoose.connection.client.db("straycare");
        const newNotification = {
            title,
            audience,
            message,
            createdAt: new Date(),
        };
        const result = await db.collection("admin_notifications").insertOne(newNotification);
        res.json({ ...newNotification, _id: result.insertedId });
    }
    catch (err) {
        console.error("Error creating admin notification:", err);
        res.status(500).json({ error: "Failed to create admin notification" });
    }
});
module.exports = router;
//# sourceMappingURL=adminNotificationsRoutes.js.map