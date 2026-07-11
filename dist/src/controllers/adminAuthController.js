"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { sendPasswordResetEmail } = require("../utils/emailService");
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin || !admin.password) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const token = jwt.sign({ id: admin._id, role: "admin", username: admin.username }, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ token, admin: { id: admin._id, username: admin.username, email: admin.email } });
    }
    catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: "Login failed" });
    }
};
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) {
            res.json({ message: "If this email exists, a reset link has been sent." });
            return;
        }
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        admin.resetToken = token;
        admin.resetTokenExpiry = new Date(Date.now() + 3600000);
        await admin.save();
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        await sendPasswordResetEmail(email, resetLink);
        res.json({ message: "If this email exists, a reset link has been sent." });
    }
    catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
};
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            res.status(400).json({ error: "Token and new password are required" });
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        }
        catch (err) {
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
    }
    catch (err) {
        console.error("RESET PASSWORD ERROR:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
};
//# sourceMappingURL=adminAuthController.js.map