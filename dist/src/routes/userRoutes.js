"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { getPublicProfile, getUserPosts, getUserReports, createUserReport, getUserReportsAdmin, searchUsers, approveUser, } = require("../controllers/userController");
const { verifyToken } = require("../middleware/authMiddleware");
// Router for user profile endpoints
const userRouter = express.Router();
userRouter.get("/search", verifyToken, searchUsers);
userRouter.get("/:userId/public-profile", getPublicProfile);
userRouter.get("/:userId/posts", getUserPosts);
userRouter.get("/:userId/reports", getUserReports);
// Router for user reports
const reportRouter = express.Router();
reportRouter.post("/user", verifyToken, createUserReport);
// Router for admin endpoints
const adminRouter = express.Router();
adminRouter.get("/user-reports", verifyToken, getUserReportsAdmin);
adminRouter.patch("/approve-user/:userId", verifyToken, approveUser);
module.exports = {
    userRouter,
    reportRouter,
    adminRouter,
};
//# sourceMappingURL=userRoutes.js.map