// src/routes/authRoutes.ts

const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";

console.log("AUTH ROUTES FILE ACTIVE");

const { register, login, googleAuth, selectRole, getMe, forgotPassword, resetPassword, changePassword, deleteAccount } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/test", (req: Request, res: Response) => {
  res.send("Auth test working");
});

router.post("/register", register);
router.post("/login", login);
router.post("/Login", login);
router.post("/google", googleAuth);
router.put("/select-role", verifyToken, selectRole);
router.get("/me", verifyToken, getMe);
router.delete("/me", verifyToken, deleteAccount);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
