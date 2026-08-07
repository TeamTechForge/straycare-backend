"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const ROLE_COLLECTIONS = [
    { collection: "users", role: "General User" },
    { collection: "rescuers", role: "Rescuer" },
    { collection: "volunteerprofiles", role: "Volunteer" },
    { collection: "ngoprofiles", role: "NGO" },
    { collection: "vetprofiles", role: "Vet" },
];
// Find which collection a user belongs to, and return their record
async function findUserAcrossCollections(db, userId) {
    const objectId = new mongoose.Types.ObjectId(userId);
    for (const { collection, role } of ROLE_COLLECTIONS) {
        const user = await db.collection(collection).findOne({ _id: objectId });
        if (user)
            return { user, collection, role };
    }
    return null;
}
// GET /api/moderation/user/:id - find a reported user's details + role
router.get("/user/:id", async (req, res) => {
    try {
        const db = mongoose.connection.client.db("straycare");
        const result = await findUserAcrossCollections(db, String(req.params.id));
        if (!result)
            return res.status(404).json({ error: "User not found in any collection" });
        // Don't send password hash to frontend
        const { password, ...safeUser } = result.user;
        res.json({ ...result, user: safeUser });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// PATCH /api/moderation/user/:id/action - apply Dismiss/Warn/Suspend
router.patch("/user/:id/action", async (req, res) => {
    try {
        const { action, reportId } = req.body; // action: "Dismiss" | "Warn" | "Suspend"
        const db = mongoose.connection.client.db("straycare");
        if (action === "Warn" || action === "Suspend") {
            const result = await findUserAcrossCollections(db, String(req.params.id));
            if (!result)
                return res.status(404).json({ error: "User not found" });
            const accountStatus = action === "Warn" ? "Warned" : "Suspended";
            await db.collection(result.collection).updateOne({ _id: new mongoose.Types.ObjectId(String(req.params.id)) }, { $set: { accountStatus } });
        }
        if (reportId) {
            await db.collection("userreports").updateOne({ _id: new mongoose.Types.ObjectId(reportId) }, { $set: { status: "Resolved" } });
        }
        res.json({ success: true, action });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;
//# sourceMappingURL=moderationRoutes.js.map