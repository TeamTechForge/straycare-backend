const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { createSupportTicket } = require("../controllers/supportController");

router.post("/", verifyToken, createSupportTicket);

module.exports = router;
