const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
import {
  getAllUsers,
  getGeneralUsers,
  getVetsAndNgos,
  getUserDocuments,
  updateUserStatus,
} from "../controllers/usersManagementController";

router.use(verifyToken, requireAdmin);

// Unified users list (all roles)
router.get("/all", getAllUsers);

// General users only
router.get("/general", getGeneralUsers);

// NGOs + Vets combined
router.get("/vets-ngos", getVetsAndNgos);

// Fetch full details for a specific user (NGO or Vet)
router.get("/:id/documents", getUserDocuments);

// Update user status (verify/reject)
router.patch("/:id/status", updateUserStatus);

module.exports = router;
