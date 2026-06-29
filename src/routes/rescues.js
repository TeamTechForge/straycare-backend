const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

router.get("/rescue-cases", async (req, res) => {
  try {
    const testDb = mongoose.connection.client.db("test");
    const rescues = await testDb.collection("strayreports").find({}).sort({ createdAt: -1 }).toArray();
    res.json(rescues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
