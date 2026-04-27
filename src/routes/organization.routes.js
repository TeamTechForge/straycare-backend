const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

const router = express.Router();

// Get all organizations
router.get("/", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const orgs = await db.collection("Organizations").find({}).toArray(); 
    console.log("Organizations found:", orgs.length);
    res.json(orgs);
  } catch (err) {
    console.error("Error fetching organizations:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

// Get organizations by category
router.get("/category/:category", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const orgs = await db
      .collection("Organizations")
      .find({ category: req.params.category })
      .toArray();
    res.json(orgs);
  } catch (err) {
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

    const result = await db.collection("Organizations").insertOne({
      name,
      category,
      location,
      description,
      createdAt: new Date(),
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
router.delete("/:id", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const result = await db
      .collection("Organizations")
      .deleteOne({ _id: new ObjectId(req.params.id) });

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

