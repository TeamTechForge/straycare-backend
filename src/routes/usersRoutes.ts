const express = require("express");
const mongoose = require("mongoose");
const { sendOrganizationVerificationEmail } = require("../utils/emailService");
const router = express.Router();

import type { Request, Response } from "express";

// Unified users list (all roles)
router.get("/all", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");

    const rescuers = await db.collection("rescuers").find({}).toArray();
    const volunteers = await db.collection("volunteerprofiles").find({}).toArray();
    const generalUsers = await db.collection("users").find({}).toArray();
    const ngos = await db.collection("ngoprofiles").find({}).toArray();
    const vets = await db.collection("vetprofiles").find({}).toArray();

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
});

// General users only
router.get("/general", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const generalUsers = await db.collection("users").find({}).toArray();
    res.json(generalUsers.map((u: any) => ({ ...u, role: "General User" })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// NGOs + Vets combined
router.get("/vets-ngos", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const ngos = await db.collection("ngoprofiles").find({}).toArray();
    const vets = await db.collection("vetprofiles").find({}).toArray();

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
});

// Fetch full details for a specific user (NGO or Vet)
router.get("/:id/documents", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");

    const ngo = await db.collection("ngoprofiles").findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
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

    const vet = await db.collection("vetprofiles").findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
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
});

// Update user status (verify/reject)
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: "Status must be Verified or Rejected" });
    }

    const db = mongoose.connection.client.db("straycare");
    const collections = ["ngoprofiles", "vetprofiles"];
    let updated: any = null;

    for (const col of collections) {
      const result: any = await db.collection(col).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.params.id) },
        { $set: { status } },
        { returnDocument: "after" }
      );
      const updatedDocument = result?.value ?? result;
      if (updatedDocument) {
        updated = updatedDocument;
        
        // BUG FIX: Ensure the main User document's `isApproved` flag stays in sync
        const isApproved = status === "Verified";
        await db.collection("users").updateOne(
          { _id: updated.userId },
          { $set: { isApproved } }
        );
        
        break;
      }
    }

    if (!updated) return res.status(404).json({ error: "User not found" });

    let emailSent = false;
    const account = await db.collection("users").findOne({ _id: updated.userId });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
