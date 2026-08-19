const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const {
  createSupportTicket,
  getAllSupportTickets,
  updateSupportTicket,
} = require("../controllers/supportController");

router.post("/", verifyToken, createSupportTicket);
router.get("/", verifyToken, requireAdmin, getAllSupportTickets);
router.patch("/:id", verifyToken, requireAdmin, updateSupportTicket);

module.exports = router;
