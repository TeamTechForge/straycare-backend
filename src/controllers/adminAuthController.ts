import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const Admin = require("../models/Admin");
const { sendPasswordResetEmail } = require("../utils/emailService");

import { JwtService } from "../services/JwtService";
import { PasswordService } from "../services/PasswordService";
import type { Request, Response } from "express";

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

    const token = JwtService.generateToken(
      { id: admin._id, role: "admin", username: admin.username },
      "8h"
    );

    res.json({ token, admin: { id: admin._id, username: admin.username, email: admin.email } });
  });;

exports.forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      res.json({ message: "If this email exists, a reset link has been sent." });
      return;
    }

    const token = JwtService.generateToken({ email }, "1h");
    admin.resetToken = token;
    admin.resetTokenExpiry = new Date(Date.now() + 3600000);
    await admin.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetLink);

    res.json({ message: "If this email exists, a reset link has been sent." });
  });;

exports.resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }

    let decoded: any;
    try {
      decoded = JwtService.verifyToken(token);
    } catch (err) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }

    const admin = await Admin.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!admin) {
      res.status(400).json({ error: "Invalid or expired token" });
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
