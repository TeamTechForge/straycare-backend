const express = require("express");
const {
  createGeneralProfile,
  createVolunteerProfile,
  createNGOProfile,
  createVetProfile,
} = require("../controllers/profileController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// All profile routes are protected by JWT
router.post("/general", verifyToken, createGeneralProfile);
router.post("/volunteer", verifyToken, createVolunteerProfile);
router.post("/ngo", verifyToken, createNGOProfile);
router.post("/vet", verifyToken, createVetProfile);

module.exports = router;
