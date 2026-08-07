const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
 
const router = express.Router();

import type { Request, Response } from "express";
 
// Get all organizations (vetprofiles + ngoprofiles)
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    const vets = await db.collection("vetprofiles").find({}).toArray();
    const shelters = await db.collection("ngoprofiles").find({}).toArray();
    res.json([...vets, ...shelters]);
  } catch (err) {
    console.error("Error fetching organizations:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});
 
// Get organizations by category
router.get("/category/:category", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    let results: any[] = [];
 
    if (req.params.category === "Support Vet Clinic") {
      results = await db.collection("vetprofiles").find({}).toArray();
    } else if (req.params.category === "Support Shelter") {
      results = await db.collection("ngoprofiles").find({}).toArray();
    }
 
    res.json(results);
  } catch (err) {
    console.error("Error fetching organizations by category:", err);
    res.status(500).json({ error: "Failed to fetch organizations by category" });
  }
});
 
// Create a new organization
router.post("/", async (req: Request, res: Response) => {
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
  } catch (err) {
    console.error("Error creating organization:", err);
    res.status(500).json({ error: "Failed to create organization" });
  }
});
 
// Delete an organization
router.delete("/:id", async (req: Request, res: Response) => {
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
  } catch (err) {
    console.error("Error deleting organization:", err);
    res.status(500).json({ error: "Failed to delete organization" });
  }
});
 
module.exports = router;
