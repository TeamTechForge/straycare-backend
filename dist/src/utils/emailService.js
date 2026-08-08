"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});
// Password reset email
const sendPasswordResetEmail = async (toEmail, resetLink) => {
    const mailOptions = {
        from: `"StrayCare Admin" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "StrayCare Admin - Password Reset Request",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F5A623;">StrayCare Admin Dashboard</h2>
        <p>You requested a password reset for your admin account.</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #F5A623;
          color: #fff;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        ">Reset Password</a>
        <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email. Your password won't change.</p>
        <p style="color: #888; font-size: 13px;">Or copy this link: ${resetLink}</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
};
// Admin invitation email
const sendAdminInviteEmail = async (toEmail, inviteLink, username) => {
    const mailOptions = {
        from: `"StrayCare Admin" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "StrayCare Admin - Admin Invitation",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F5A623;">StrayCare Admin Dashboard</h2>
        <p>Hello ${username},</p>
        <p>You have been invited to join StrayCare as an admin.</p>
        <p>Click the button below to set your password and activate your account. This link expires in <strong>1 hour</strong>.</p>
        <a href="${inviteLink}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #F5A623;
          color: #fff;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        ">Accept Invitation</a>
        <p style="color: #888; font-size: 13px;">If you weren't expecting this, you can ignore this email.</p>
        <p style="color: #888; font-size: 13px;">Or copy this link: ${inviteLink}</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
};
// 6-Digit Code Password reset email for general users
const sendPasswordResetCodeEmail = async (toEmail, code) => {
    const mailOptions = {
        from: `"StrayCare Support" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "StrayCare - Your Password Reset Code",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F5A623;">StrayCare Password Reset</h2>
        <p>You requested a password reset for your account.</p>
        <p>Enter the following 6-digit code in the app to reset your password. This code expires in <strong>15 minutes</strong>.</p>
        <div style="
          display: inline-block;
          padding: 12px 24px;
          background: #fde7c7;
          color: #333;
          font-size: 24px;
          letter-spacing: 4px;
          border-radius: 8px;
          font-weight: bold;
          margin: 20px 0;
        ">${code}</div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
};
module.exports = { sendPasswordResetEmail, sendAdminInviteEmail, sendPasswordResetCodeEmail };
//# sourceMappingURL=emailService.js.map