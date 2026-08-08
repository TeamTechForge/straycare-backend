
const express = require("express");
const {
  findNearestRescuer,
  sendRescueRequest,
  checkRequestStatus,
  listRescuers,
  getActiveRescuerRequest,
  respondToRescueRequest,
  updateRescueDetails,
  cancelRescueRequest,
  acceptFromMap,
} = require("../controllers/rescueController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// List all rescuers (useful for testing in Postman to verify data exists)
router.get("/rescuers", listRescuers);

// Find the nearest available rescuer to a given location
router.post("/find-nearest", findNearestRescuer);

// Send a rescue request to a specific rescuer by their ID
router.post("/send-request", sendRescueRequest);

// Cancel a rescue request
router.patch("/request/:id/cancel", cancelRescueRequest);

// Check the current status of a rescue request (pending / accepted / rejected)
router.get("/status/:requestId", checkRequestStatus);

// Rescuer active request polling & real-time acceptance response
router.get("/active-request", verifyToken, getActiveRescuerRequest);
router.patch("/request/:id/respond", verifyToken, respondToRescueRequest);
router.patch("/request/:id/details", verifyToken, updateRescueDetails);

// Accept a rescue case directly from the public map (rescuers only)
router.post("/accept-from-map", verifyToken, acceptFromMap);

module.exports = router;
