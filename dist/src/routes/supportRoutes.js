"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { createSupportTicket } = require("../controllers/supportController");
router.post("/", verifyToken, createSupportTicket);
module.exports = router;
//# sourceMappingURL=supportRoutes.js.map