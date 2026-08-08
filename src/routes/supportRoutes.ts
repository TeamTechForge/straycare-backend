const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  createSupportTicket,
  getAllSupportTickets,
  updateSupportTicket,
} = require("../controllers/supportController");

router.post("/", verifyToken, createSupportTicket);
router.get("/", verifyToken, getAllSupportTickets);
router.patch("/:id", verifyToken, updateSupportTicket);

module.exports = router;
