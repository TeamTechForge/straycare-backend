"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/nearbyRoutes.ts
const express = require("express");
const router = express.Router();
const Rescuer = require("../models/Rescuer");
const nearbyController_1 = require("../controllers/nearbyController");
// Instantiate the controller with the required model dependency
const nearbyController = new nearbyController_1.NearbyController(Rescuer);
// GET /api/nearby?lat=..&lng=..
router.get("/", nearbyController.findNearbyRescuers);
module.exports = router;
//# sourceMappingURL=nearbyRoutes.js.map