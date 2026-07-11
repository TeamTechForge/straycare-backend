// src/routes/nearbyRoutes.ts
const express = require("express");
const router = express.Router();
const Rescuer = require("../models/Rescuer");

import { NearbyController } from "../controllers/nearbyController";
import type { Request, Response } from "express";

// Instantiate the controller with the required model dependency
const nearbyController = new NearbyController(Rescuer);

// GET /api/nearby?lat=..&lng=..
router.get("/", nearbyController.findNearbyRescuers);

module.exports = router;
