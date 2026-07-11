// src/routes/nearbyRoutes.ts
const express = require("express");
const router = express.Router();
const Rescuer = require("../models/Rescuer");

import type { Request, Response } from "express";

// GET /api/nearby?lat=..&lng=..
router.get("/", async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    const rescuers = await Rescuer.find({
      isAvailable: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng as string), parseFloat(lat as string)] },
          $maxDistance: 5000
        }
      }
    });

    return res.json(rescuers);
  } catch (err: any) {
    return res.status(500).json({ message: "Error finding nearby rescuers", error: err.message });
  }
});

module.exports = router;
