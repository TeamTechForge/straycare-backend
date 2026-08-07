"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createGeneralProfile, createVolunteerProfile, createNGOProfile, createVetProfile, getMyProfile, updateGeneralProfile, updateVolunteerProfile, updateNGOProfile, updateVetProfile, } = require("../controllers/profileController");
const { verifyToken } = require("../middleware/authMiddleware");
const router = express.Router();
// All profile routes are protected by JWT
router.post("/general", verifyToken, createGeneralProfile);
router.post("/volunteer", verifyToken, createVolunteerProfile);
router.post("/ngo", verifyToken, createNGOProfile);
router.post("/vet", verifyToken, createVetProfile);
router.get("/me", verifyToken, getMyProfile);
router.put("/general", verifyToken, updateGeneralProfile);
router.put("/volunteer", verifyToken, updateVolunteerProfile);
router.put("/ngo", verifyToken, updateNGOProfile);
router.put("/vet", verifyToken, updateVetProfile);
module.exports = router;
//# sourceMappingURL=profileRoutes.js.map