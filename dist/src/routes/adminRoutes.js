"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwtService_1 = require("../services/jwtService");
const { sendAdminInviteEmail } = require("../utils/emailService");
// GET all admins (active + those with no status but have password)
router.get("/", authMiddleware, async (req, res) => {
    try {
        const admins = await Admin.find({
            $or: [
                { status: "active" },
                { status: { $exists: false }, password: { $exists: true, $ne: null } },
                { status: null, password: { $exists: true, $ne: null } },
            ]
        }, { password: 0 });
        res.json(admins);
    }
    catch (err) {
        res.status(500).json({ error: "Failed to fetch admins" });
    }
});
// POST migrate existing admins to active status (run once)
router.post("/migrate", authMiddleware, async (req, res) => {
    try {
        const result = await Admin.updateMany({ status: { $exists: false }, password: { $exists: true, $ne: null } }, { $set: { status: "active" } });
        const result2 = await Admin.updateMany({ status: null, password: { $exists: true, $ne: null } }, { $set: { status: "active" } });
        res.json({ success: true, updated: result.modifiedCount + result2.modifiedCount });
    }
    catch (err) {
        res.status(500).json({ error: "Migration failed" });
    }
});
// POST invite new admin
router.post("/invite", authMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;
        if (!username || !email) {
            return res.status(400).json({ error: "Username and email are required" });
        }
        const existing = await Admin.findOne({ email });
        if (existing) {
            // If already active, block it
            if (existing.status === "active") {
                return res.status(400).json({ error: "An active admin with this email already exists" });
            }
            // If pending, resend the invite with a fresh token
            if (existing.status === "pending") {
                const token = jwtService_1.JwtService.generateToken({ email }, "1h");
                existing.invitationToken = token;
                await existing.save();
                const inviteLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&type=invite`;
                await sendAdminInviteEmail(email, inviteLink, existing.username);
                return res.json({ success: true, message: "Invitation resent successfully!" });
            }
        }
        // New admin
        const token = jwtService_1.JwtService.generateToken({ email }, "1h");
        const admin = new Admin({
            username, email, role: "admin",
            invitationToken: token, status: "pending"
        });
        await admin.save();
        const inviteLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&type=invite`;
        await sendAdminInviteEmail(email, inviteLink, username);
        res.json({ success: true, message: "Invitation sent successfully!" });
    }
    catch (err) {
        console.error("INVITE ERROR:", err);
        res.status(500).json({ error: "Failed to send invitation" });
    }
});
// POST accept invitation
router.post("/accept-invite", async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: "Token and new password are required" });
        }
        try {
            jwtService_1.JwtService.verifyToken(token);
        }
        catch (err) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }
        const admin = await Admin.findOne({ invitationToken: token, status: "pending" });
        if (!admin)
            return res.status(400).json({ error: "Invalid or expired token" });
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        admin.password = newPassword;
        admin.invitationToken = null;
        admin.status = "active";
        await admin.save();
        res.json({ success: true, message: "Account activated! You can now log in." });
    }
    catch (err) {
        console.error("ACCEPT INVITE ERROR:", err);
        res.status(500).json({ error: "Failed to accept invitation" });
    }
});
// DELETE remove admin
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await Admin.findByIdAndDelete(req.params.id);
        if (!result)
            return res.status(404).json({ error: "Admin not found" });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to delete admin" });
    }
});
// PATCH change password
router.patch("/change-password", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Please provide current and new password" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        const admin = await Admin.findById(req.user.id);
        if (!admin)
            return res.status(404).json({ error: "Admin not found" });
        const match = await bcrypt.compare(currentPassword, admin.password);
        if (!match)
            return res.status(400).json({ error: "Current password is incorrect" });
        admin.password = newPassword;
        await admin.save();
        res.json({ success: true });
    }
    catch (err) {
        console.error("CHANGE PASSWORD ERROR:", err);
        res.status(500).json({ error: "Failed to change password" });
    }
});
module.exports = router;
//# sourceMappingURL=adminRoutes.js.map