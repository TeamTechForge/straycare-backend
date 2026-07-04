const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

router.get("/rescue-cases", async (req, res) => {
  try {
   const db = mongoose.connection.client.db("straycare");
   const rescues = await db.collection("rescuerequests").find({}).sort({ createdAt: -1 }).toArray();
    res.json(rescues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
