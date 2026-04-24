// src/routes/nearbyRoutes.js
const express = require("express");
const router = express.Router();
const Rescuer = require("../models/Rescuer");

// GET /api/nearby?lat=..&lng=..
router.get("/", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const rescuers = await Rescuer.find({
      available: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: 5000
        }
      }
    });

    return res.json(rescuers);
  } catch (err) {
    return res.status(500).json({ message: "Error finding nearby rescuers", error: err.message });
  }
});

module.exports = router;
