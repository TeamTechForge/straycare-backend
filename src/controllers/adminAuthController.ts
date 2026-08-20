import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const crypto = require("crypto");
const Admin = require("../models/Admin");
const { sendAdminPasswordResetCodeEmail } = require("../utils/emailService");

import { JwtService } from "../services/jwtService";
import { PasswordService } from "../services/passwordService";
import type { Request, Response } from "express";

// Validate admin credentials and issue an eight-hour JWT.
exports.login = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const match = await PasswordService.comparePassword(password, admin.password);
    if (!match) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // The token identifies the admin on later protected requests.
    const token = JwtService.generateToken(
      { id: admin._id, role: "admin", username: admin.username },
      "8h"
    );

    res.json({ token, admin: { id: admin._id, username: admin.username, email: admin.email } });
  });;

// Create a short-lived reset code without revealing whether an email exists.
exports.forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      res.json({ message: "If this email exists, a 6-digit reset code has been sent." });
      return;
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Store only the code hash so the original code is not readable in MongoDB.
    const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

    admin.resetToken = hashedCode;
    admin.resetTokenExpiry = new Date(Date.now() + 900000); // 15 mins
    await admin.save();

    try {
      await sendAdminPasswordResetCodeEmail(admin.email, resetCode);
    } catch (err) {
      console.error("Error sending admin reset email:", err);
    }

    res.json({ message: "If this email exists, a 6-digit reset code has been sent." });
  });;

// Replace the password after validating the reset code and expiry time.
exports.resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: "Reset code and new password are required" });
      return;
    }

    const hashedCode = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      resetToken: hashedCode,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!admin) {
      res.status(400).json({ error: "Invalid or expired reset code" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    admin.password = newPassword;
    admin.resetToken = null;
    admin.resetTokenExpiry = null;

    if (admin.status === "pending") {
      admin.status = "active";
      admin.invitationToken = null;
    }

    await admin.save();
    res.json({ message: "Password reset successful" });
  });;
