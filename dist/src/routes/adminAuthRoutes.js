"use strict";
// src/routes/adminAuthRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { login, forgotPassword, resetPassword } = require("../controllers/adminAuthController");
// POST /api/admin/login
router.post("/login", login);
// POST /api/admin/forgot-password
router.post("/forgot-password", forgotPassword);
// POST /api/admin/reset-password
router.post("/reset-password", resetPassword);
module.exports = router;
//# sourceMappingURL=adminAuthRoutes.js.map