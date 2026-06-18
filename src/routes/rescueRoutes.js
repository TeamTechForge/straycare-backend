
const express = require("express");
const {
  findNearestRescuer,
  sendRescueRequest,
  checkRequestStatus,
  listRescuers,
} = require("../controllers/rescueController");

const router = express.Router();

// List all rescuers (useful for testing in Postman to verify data exists)
router.get("/rescuers", listRescuers);

// Find the nearest available rescuer to a given location
router.post("/find-nearest", findNearestRescuer);

// Send a rescue request to a specific rescuer by their ID
router.post("/send-request", sendRescueRequest);

// Check the current status of a rescue request (pending / accepted / rejected)
router.get("/status/:requestId", checkRequestStatus);

module.exports = router;
