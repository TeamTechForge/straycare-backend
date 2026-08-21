const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
import { JwtService } from "../services/jwtService";
const { sendAdminInviteEmail } = require("../utils/emailService");

import type { Request, Response } from "express";

// Return active administrators without exposing password hashes.
router.get("/", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const admins = await Admin.find(
      {
        $or: [
          { status: "active" },
          { status: { $exists: false }, password: { $exists: true, $ne: null } },
          { status: null, password: { $exists: true, $ne: null } },
        ]
      },
      { password: 0 }
    );
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// Return the account linked to the verified JWT.
router.get("/me", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = await Admin.findById((req as any).user.id, { password: 0 });
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin info" });
  }
});

// POST migrate existing admins to active status (run once)
router.post("/migrate", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await Admin.updateMany(
      { status: { $exists: false }, password: { $exists: true, $ne: null } },
      { $set: { status: "active" } }
    );
    const result2 = await Admin.updateMany(
      { status: null, password: { $exists: true, $ne: null } },
      { $set: { status: "active" } }
    );
    res.json({ success: true, updated: result.modifiedCount + result2.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: "Migration failed" });
  }
});

// Send a time-limited password setup invitation to a new admin.
router.post("/invite", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
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

      // Pending accounts receive a new token when the invite is resent.
      if (existing.status === "pending") {
        const token = JwtService.generateToken({ email }, "1h");
        existing.invitationToken = token;
        await existing.save();
        const inviteLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&type=invite`;
        await sendAdminInviteEmail(email, inviteLink, existing.username);
        return res.json({ success: true, message: "Invitation resent successfully!" });
      }
    }

    // Keep the account pending until the recipient creates a password.
    const token = JwtService.generateToken({ email }, "1h");
    const admin = new Admin({
      username, email, role: "admin",
      invitationToken: token, status: "pending"
    });
    await admin.save();
    const inviteLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&type=invite`;
    await sendAdminInviteEmail(email, inviteLink, username);
    res.json({ success: true, message: "Invitation sent successfully!" });
  } catch (err) {
    console.error("INVITE ERROR:", err);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// Activate a pending account after validating its invitation token.
router.post("/accept-invite", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    try {
      JwtService.verifyToken(token);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    const admin = await Admin.findOne({ invitationToken: token, status: "pending" });
    if (!admin) return res.status(400).json({ error: "Invalid or expired token" });
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    admin.password = newPassword;
    admin.invitationToken = null;
    admin.status = "active";
    await admin.save();
    res.json({ success: true, message: "Account activated! You can now log in." });
  } catch (err) {
    console.error("ACCEPT INVITE ERROR:", err);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// Remove another admin while preserving at least one active account.
router.delete("/:id", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Administrators cannot remove the account they are currently using.
    if (req.params.id === (req as any).user.id) {
      return res.status(400).json({ error: "You cannot remove your own administrator account" });
    }
    const activeAdminCount = await Admin.countDocuments({
      $or: [
        { status: "active" },
        { status: { $exists: false }, password: { $exists: true, $ne: null } },
        { status: null, password: { $exists: true, $ne: null } },
      ],
    });
    if (activeAdminCount <= 1) {
      return res.status(400).json({ error: "The final active administrator cannot be removed" });
    }
    const result = await Admin.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Admin not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete admin" });
  }
});

// Verify the current password before accepting a replacement.
router.patch("/change-password", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Please provide current and new password" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const admin = await Admin.findById((req as any).user.id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    const match = await bcrypt.compare(currentPassword, admin.password);
    if (!match) return res.status(400).json({ error: "Current password is incorrect" });
    admin.password = newPassword;
    await admin.save();
    res.json({ success: true });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PATCH update notification preferences for the logged-in admin
router.patch("/preferences", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { emailNotifications, donationAlerts, userReportAlerts } = req.body;

    const admin = await Admin.findById((req as any).user.id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    if (emailNotifications !== undefined) admin.emailNotifications = emailNotifications;
    if (donationAlerts !== undefined) admin.donationAlerts = donationAlerts;
    if (userReportAlerts !== undefined) admin.userReportAlerts = userReportAlerts;

    await admin.save();
    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE PREFERENCES ERROR:", err);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

module.exports = router;
