// src/routes/rescueRoutes.js
const express = require("express");
const router = express.Router();
const rescueController = require("../controllers/rescueController");

// Create rescue request
router.post("/", rescueController.createRescueRequest);

// List rescue requests (optional filters: reporterId, rescuerId, status)
router.get("/", rescueController.listRescueRequests);

// Get history for a user
router.get("/history/:userId", rescueController.getRescueHistory);

// Get one rescue request
router.get("/:requestId", rescueController.getRescueRequest);

// Accept rescue
router.post("/:requestId/accept", rescueController.acceptRescue);

// Reject rescue + fallback
router.post("/:requestId/reject", rescueController.rejectRescue);

// Update status
router.patch("/:requestId/status", rescueController.updateRescueStatus);

module.exports = router;
