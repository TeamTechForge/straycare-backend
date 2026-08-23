import type { Request, Response } from "express";
const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Admin");
const VolunteerProfile = require("../models/VolunteerProfile");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const { sendOrganizationVerificationEmail } = require("../utils/emailService");
import { NotificationService } from "../services/notificationService";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const [accounts, admins, volunteers, ngos, vets] = await Promise.all([
      User.find({}).select("-password -resetPasswordToken -resetPasswordExpires").lean(),
      Admin.find({
        $or: [
          { status: "active" },
          { status: { $exists: false }, password: { $exists: true, $ne: null } },
          { status: null, password: { $exists: true, $ne: null } },
        ],
      }).select("username email role status").lean(),
      VolunteerProfile.find({}).lean(),
      NGOProfile.find({}).lean(),
      VetProfile.find({}).lean(),
    ]);

    const byUserId = (records: any[]) =>
      new Map(records.filter((record) => record.userId).map((record) => [String(record.userId), record]));

    const volunteerByUserId = byUserId(volunteers);
    const ngoByUserId = byUserId(ngos);
    const vetByUserId = byUserId(vets);
    const roleLabels: Record<string, string> = {
      general_user: "General User",
      volunteer: "Volunteer",
      ngo: "NGO",
      vet: "Vet",
      admin: "Admin",
    };

    // Account identity always comes from the users collection. Role-specific
    // profiles only supplement it, preventing blank emails and duplicate rows.
    const registeredUsers = accounts.map((account: any) => {
      const accountId = String(account._id);
      const volunteer = volunteerByUserId.get(accountId);
      const ngo = ngoByUserId.get(accountId);
      const vet = vetByUserId.get(accountId);

      return {
        _id: account._id,
        name: ngo?.orgName || vet?.clinicName || account.name,
        email: account.email,
        phone: account.phone,
        role: roleLabels[account.role] || account.role,
        location: ngo?.location || vet?.primaryLocation || volunteer?.location,
        bio: ngo?.bio || vet?.bio || volunteer?.bio,
        profileImage: ngo?.profileImage || vet?.profileImage || volunteer?.profileImage || account.profileImage,
        status: ngo?.status || vet?.status || account.accountStatus,
        createdAt: account.createdAt,
      };
    });

    const adminUsers = admins.map((admin: any) => ({
      _id: admin._id,
      name: admin.username,
      email: admin.email,
      role: "Admin",
      status: admin.status || "active",
      createdAt: admin._id.getTimestamp(),
    }));

    const allUsers = [...registeredUsers, ...adminUsers];

    res.json(allUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getGeneralUsers = async (req: Request, res: Response) => {
  try {
    const generalUsers = await User.find({}).lean();
    res.json(generalUsers.map((u: any) => ({ ...u, role: "General User" })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getVetsAndNgos = async (req: Request, res: Response) => {
  try {
    const ngos = await NGOProfile.find({}).lean();
    const vets = await VetProfile.find({}).lean();

    const combined = [
      ...ngos.map((u: any) => ({
        _id: u._id,
        role: "NGO",
        name: u.orgName,
        contactPerson: u.contactPerson,
        regNumber: u.regNumber,
        foundedYear: u.foundedYear,
        location: u.location,
        bio: u.bio,
        verificationDocument: u.verificationDocument,
        status: u.status || "Pending",
        createdAt: u.createdAt,
      })),
      ...vets.map((u: any) => ({
        _id: u._id,
        role: "Vet",
        name: u.clinicName,
        regNumber: u.licenseNumber,
        foundedYear: u.yearsOfExperience ? `${u.yearsOfExperience} yrs exp` : null,
        location: u.primaryLocation,
        bio: u.bio,
        verificationDocument: u.licenseDocument,
        status: u.status || "Pending",
        createdAt: u.createdAt,
      })),
    ];

    res.json(combined);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserDocuments = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const ngo = await NGOProfile.findById(req.params.id).lean();
    if (ngo) {
      return res.json({
        user: {
          _id: ngo._id,
          role: "NGO",
          name: ngo.orgName,
          contactPerson: ngo.contactPerson,
          regNumber: ngo.regNumber,
          foundedYear: ngo.foundedYear,
          location: ngo.location,
          bio: ngo.bio,
          status: ngo.status || "Pending",
          rejectionReason: ngo.rejectionReason || "",
          createdAt: ngo.createdAt,
        },
        documents: ngo.verificationDocument
          ? [{ type: "Verification Document", url: ngo.verificationDocument }]
          : [],
      });
    }

    const vet = await VetProfile.findById(req.params.id).lean();
    if (vet) {
      return res.json({
        user: {
          _id: vet._id,
          role: "Vet",
          name: vet.clinicName,
          regNumber: vet.licenseNumber,
          foundedYear: vet.yearsOfExperience ? `${vet.yearsOfExperience} years of experience` : null,
          location: vet.primaryLocation,
          bio: vet.bio,
          status: vet.status || "Pending",
          rejectionReason: vet.rejectionReason || "",
          createdAt: vet.createdAt,
        },
        documents: vet.licenseDocument
          ? [{ type: "License Document", url: vet.licenseDocument }]
          : [],
      });
    }

    return res.status(404).json({ error: "User not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;

    const allowedRejectionReasons = [
      "Registration or license details could not be verified",
      "Submitted document is unclear, expired, or incomplete",
      "Organization details do not match the submitted document",
      "Required verification information is missing",
    ];

    if (!["Verified", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be Verified or Rejected" });
    }

    if (status === "Rejected" && !allowedRejectionReasons.includes(rejectionReason)) {
      return res.status(400).json({ error: "A valid rejection reason is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    let updated: any = null;

    updated = await NGOProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { status, rejectionReason: status === "Rejected" ? rejectionReason : "" } },
      { new: true }
    ).lean();

    if (!updated) {
      updated = await VetProfile.findByIdAndUpdate(
        req.params.id,
        { $set: { status, rejectionReason: status === "Rejected" ? rejectionReason : "" } },
        { new: true }
      ).lean();
    }

    if (updated) {
      // BUG FIX: Ensure the main User document's `isApproved` flag stays in sync
      const isApproved = status === "Verified";
      await User.updateOne(
        { _id: updated.userId },
        { $set: { isApproved } }
      );

      let emailSent = false;
      const account = await User.findById(updated.userId).lean();

      if (status === "Verified" && account) {
        // Send Welcome notification for verified users
        await NotificationService.sendNotification(
          String(account._id),
          "Welcome to StrayCare!",
          `Hi ${account.name}, welcome to our community! Together we can save more stray animals. 🐾`,
          "welcome"
        );

        // Emit real-time update via Socket.IO
        const io = req.app.get("io");
        if (io) {
          io.of("/chat").to(`user:${account._id}`).emit("user:approved", {
            notification: {
              title: "Welcome to StrayCare!",
              message: `Hi ${account.name}, welcome to our community! Together we can save more stray animals. 🐾`,
              type: "welcome"
            },
          });
        }
      }

      if (account?.email) {
        try {
          await sendOrganizationVerificationEmail(
            account.email,
            updated.orgName || updated.clinicName || account.name,
            status,
            status === "Rejected" ? rejectionReason : undefined
          );
          emailSent = true;
        } catch (emailError) {
          console.error("Organization verification email failed:", emailError);
        }
      }

      res.json({
        success: true,
        user: updated,
        emailSent,
        message: emailSent
          ? `Organization ${status.toLowerCase()} and confirmation email sent`
          : `Organization ${status.toLowerCase()}, but the confirmation email could not be sent`,
      });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
