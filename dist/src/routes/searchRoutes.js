"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { search } = require("../controllers/searchController");
const { verifyToken } = require("../middleware/authMiddleware");
const router = express.Router();
// Protected search endpoint
router.get("/", verifyToken, search);
module.exports = router;
//# sourceMappingURL=searchRoutes.js.map