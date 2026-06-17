// src/routes/authRoutes.js


const express = require("express");
const router = express.Router();

console.log("AUTH ROUTES FILE ACTIVE");

const { register, login, selectRole, getMe, forgotPassword, resetPassword, changePassword, deleteAccount } = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/test", (req, res) => {
  res.send("Auth test working");
});

router.post("/register", register);
router.post("/login", login);
router.put("/select-role", verifyToken, selectRole);
router.get("/me", verifyToken, getMe);
router.delete("/me", verifyToken, deleteAccount);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;