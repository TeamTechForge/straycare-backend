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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });

// Password reset email
const sendPasswordResetEmail = async (toEmail: string, resetLink: string): Promise<void> => {
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
const sendAdminInviteEmail = async (toEmail: string, inviteLink: string, username: string): Promise<void> => {
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
const sendPasswordResetCodeEmail = async (toEmail: string, code: string): Promise<void> => {
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

// Admin 6-Digit Code Password reset email
const sendAdminPasswordResetCodeEmail = async (toEmail: string, code: string): Promise<void> => {
  const mailOptions = {
    from: `"StrayCare Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "StrayCare Admin - Your Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F5A623;">StrayCare Admin Dashboard</h2>
        <p>You requested a password reset for your admin account.</p>
        <p>Enter the following 6-digit code in the admin dashboard to reset your password. This code expires in <strong>15 minutes</strong>.</p>
        <div style="display: inline-block; padding: 12px 24px; background: #fde7c7; color: #333; font-size: 24px; letter-spacing: 4px; border-radius: 8px; font-weight: bold; margin: 20px 0;">${code}</div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendSupportTicketReplyEmail = async (
  toEmail: string,
  recipientName: string,
  subject: string,
  reply: string,
  status: string
): Promise<void> => {
  const safeName = escapeHtml(recipientName || "StrayCare user");
  const safeSubject = escapeHtml(subject);
  const safeReply = escapeHtml(reply).replace(/\n/g, "<br />");
  const safeStatus = escapeHtml(status);

  await transporter.sendMail({
    from: `"StrayCare Support" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `StrayCare Support Reply: ${subject}`,
    text: `Hello ${recipientName || "StrayCare user"},\n\nOur support team replied to your ticket "${subject}".\n\n${reply}\n\nStatus: ${status}\n\nStrayCare Support`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #412828;">
        <h2 style="color: #F5A623;">StrayCare Support</h2>
        <p>Hello ${safeName},</p>
        <p>Our support team replied to your ticket:</p>
        <div style="background: #FFF9E6; border-left: 4px solid #F5A623; padding: 14px 16px; margin: 18px 0;">
          <strong>${safeSubject}</strong>
          <p style="margin: 10px 0 0; line-height: 1.6;">${safeReply}</p>
        </div>
        <p><strong>Status:</strong> ${safeStatus}</p>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">You received this email because you submitted a support request through StrayCare.</p>
      </div>
    `,
  });
};

const sendOrganizationVerificationEmail = async (
  toEmail: string,
  organizationName: string,
  status: "Verified" | "Rejected"
): Promise<void> => {
  const safeName = escapeHtml(organizationName || "Organization representative");
  const isVerified = status === "Verified";
  const resultHeading = isVerified ? "Verification approved" : "Verification not approved";
  const resultMessage = isVerified
    ? "Your organization profile has been verified. You can now access the organization features available in StrayCare."
    : "We could not verify your organization using the submitted information. Please review your profile and verification documents before contacting StrayCare support or submitting updated information.";

  await transporter.sendMail({
    from: `"StrayCare Verification" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `StrayCare Organization ${status}`,
    text: `Hello ${organizationName || "Organization representative"},\n\n${resultHeading}.\n\n${resultMessage}\n\nStrayCare Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #412828;">
        <h2 style="color: #F5A623;">StrayCare Organization Verification</h2>
        <p>Hello ${safeName},</p>
        <div style="background: ${isVerified ? "#F0FDF4" : "#FFF7ED"}; border-left: 4px solid ${isVerified ? "#16A34A" : "#EA580C"}; padding: 14px 16px; margin: 18px 0;">
          <strong>${resultHeading}</strong>
          <p style="margin: 8px 0 0; line-height: 1.6;">${resultMessage}</p>
        </div>
        <p style="color: #888; font-size: 13px;">This email was sent after an administrator reviewed your organization verification documents.</p>
      </div>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendAdminInviteEmail,
  sendPasswordResetCodeEmail,
  sendAdminPasswordResetCodeEmail,
  sendSupportTicketReplyEmail,
  sendOrganizationVerificationEmail,
};
