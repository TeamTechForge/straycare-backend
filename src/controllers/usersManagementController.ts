import type { Request, Response } from "express";
const mongoose = require("mongoose");
const User = require("../models/User");
const Rescuer = require("../models/Rescuer");
const VolunteerProfile = require("../models/VolunteerProfile");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const { sendOrganizationVerificationEmail } = require("../utils/emailService");

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const rescuers = await Rescuer.find({}).lean();
    const volunteers = await VolunteerProfile.find({}).lean();
    const generalUsers = await User.find({}).lean();
    const ngos = await NGOProfile.find({}).lean();
    const vets = await VetProfile.find({}).lean();

    const allUsers = [
      ...rescuers.map((u: any) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: "Rescuer",
        location: u.location,
        createdAt: u.createdAt,
      })),
      ...volunteers.map((u: any) => ({
        _id: u._id,
        userId: u.userId,
        name: u.name || "Volunteer",
        email: u.email || null,
        role: "Volunteer",
        location: u.location,
        bio: u.bio,
        profileImage: u.profileImage,
        createdAt: u.createdAt,
      })),
      ...generalUsers.map((u: any) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: "General User",
        createdAt: u.createdAt,
      })),
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
    const { status } = req.body;

    if (!["Verified", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be Verified or Rejected" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    let updated: any = null;

    updated = await NGOProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!updated) {
      updated = await VetProfile.findByIdAndUpdate(
        req.params.id,
        { $set: { status } },
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
      if (account?.email) {
        try {
          await sendOrganizationVerificationEmail(
            account.email,
            updated.orgName || updated.clinicName || account.name,
            status
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
