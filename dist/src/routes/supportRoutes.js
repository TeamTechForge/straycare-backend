"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { createSupportTicket, getAllSupportTickets, updateSupportTicket, } = require("../controllers/supportController");
router.post("/", verifyToken, createSupportTicket);
router.get("/", verifyToken, getAllSupportTickets);
router.patch("/:id", verifyToken, updateSupportTicket);
module.exports = router;
//# sourceMappingURL=supportRoutes.js.map