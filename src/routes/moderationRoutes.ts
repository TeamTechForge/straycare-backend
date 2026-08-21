const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

import type { Request, Response } from "express";

interface RoleCollection {
  collection: string;
  role: string;
}

const ROLE_COLLECTIONS: RoleCollection[] = [
  { collection: "users", role: "General User" },
  { collection: "rescuers", role: "Rescuer" },
  { collection: "volunteerprofiles", role: "Volunteer" },
  { collection: "ngoprofiles", role: "NGO" },
  { collection: "vetprofiles", role: "Vet" },
];

// Locate a reported account across the supported role collections.
async function findUserAcrossCollections(db: any, userId: string): Promise<{ user: any; collection: string; role: string } | null> {
  const objectId = new mongoose.Types.ObjectId(userId);
  for (const { collection, role } of ROLE_COLLECTIONS) {
    const user = await db.collection(collection).findOne({ _id: objectId });
    if (user) return { user, collection, role };
  }
  return null;
}

// Return the reported user's details and detected role.
router.get("/user/:id", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const result = await findUserAcrossCollections(db, String(req.params.id));
    if (!result) return res.status(404).json({ error: "User not found in any collection" });

    // Never send a password hash to the dashboard.
    const { password, ...safeUser } = result.user;
    res.json({ ...result, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Apply the selected moderation action and resolve the reviewed report.
router.patch("/user/:id/action", async (req: Request, res: Response) => {
  try {
    const { action, reportId } = req.body;
    const db = mongoose.connection.client.db("straycare");

    if (action === "Warn" || action === "Suspend") {
      const result = await findUserAcrossCollections(db, String(req.params.id));
      if (!result) return res.status(404).json({ error: "User not found" });

      const accountStatus = action === "Warn" ? "Warned" : "Suspended";
      await db.collection(result.collection).updateOne(
        { _id: new mongoose.Types.ObjectId(String(req.params.id)) },
        { $set: { accountStatus } }
      );
    }

    // Mark the report resolved after the admin completes the review.
    if (reportId) {
      await db.collection("userreports").updateOne(
        { _id: new mongoose.Types.ObjectId(reportId) },
        { $set: { status: "Resolved" } }
      );
    }

    res.json({ success: true, action });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
