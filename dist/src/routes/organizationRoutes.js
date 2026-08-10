"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const router = express.Router();
// Filter: only verified orgs that have provided both merchant credentials
const eligibleFilter = {
    status: "Verified",
    merchantId: { $exists: true, $nin: [null, ""] },
    merchantSecret: { $exists: true, $nin: [null, ""] },
};
// Get all organizations (vetprofiles + ngoprofiles) — only verified & payment-ready
router.get("/", async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const vets = await db.collection("vetprofiles").find(eligibleFilter).toArray();
        const shelters = await db.collection("ngoprofiles").find(eligibleFilter).toArray();
        res.json([...vets, ...shelters]);
    }
    catch (err) {
        console.error("Error fetching organizations:", err);
        res.status(500).json({ error: "Failed to fetch organizations" });
    }
});
// Get organizations by category — only verified & payment-ready
router.get("/category/:category", async (req, res) => {
    try {
        const db = mongoose.connection.db;
        let results = [];
        if (req.params.category === "Support Vet Clinic") {
            results = await db.collection("vetprofiles").find(eligibleFilter).toArray();
        }
        else if (req.params.category === "Support Shelter") {
            results = await db.collection("ngoprofiles").find(eligibleFilter).toArray();
        }
        res.json(results);
    }
    catch (err) {
        console.error("Error fetching organizations by category:", err);
        res.status(500).json({ error: "Failed to fetch organizations by category" });
    }
});
// Create a new organization
router.post("/", async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const { name, category, location, description } = req.body;
        if (!name || !category) {
            return res.status(400).json({ error: "Name and category are required" });
        }
        const collection = category === "Support Vet Clinic" ? "vetprofiles" : "ngoprofiles";
        const result = await db.collection(collection).insertOne({
            name, category, location, description, createdAt: new Date(),
        });
        res.json({
            success: true,
            organization: { _id: result.insertedId, name, category, location, description },
        });
    }
    catch (err) {
        console.error("Error creating organization:", err);
        res.status(500).json({ error: "Failed to create organization" });
    }
});
// Delete an organization
router.delete("/:id", async (req, res) => {
    try {
        const db = mongoose.connection.db;
        // Try deleting from both collections
        let result = await db.collection("vetprofiles")
            .deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            result = await db.collection("ngoprofiles")
                .deleteOne({ _id: new ObjectId(req.params.id) });
        }
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error("Error deleting organization:", err);
        res.status(500).json({ error: "Failed to delete organization" });
    }
});
module.exports = router;
//# sourceMappingURL=organizationRoutes.js.map