"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { getPublicProfile, getUserPosts, getUserReports, createUserReport, getUserReportsAdmin, searchUsers, approveUser, updatePrivacySettings, savePushToken, deletePushToken, toggleBlockUser, } = require("../controllers/userController");
const { verifyToken } = require("../middleware/authMiddleware");
// Router for user profile endpoints
const userRouter = express.Router();
userRouter.get("/search", verifyToken, searchUsers);
userRouter.put("/privacy", verifyToken, updatePrivacySettings);
userRouter.get("/:userId/public-profile", verifyToken, getPublicProfile);
userRouter.get("/:userId/posts", getUserPosts);
userRouter.get("/:userId/reports", getUserReports);
userRouter.post("/:id/block", verifyToken, toggleBlockUser);
// Store push notification token for mobile notifications
userRouter.post("/push-token", verifyToken, savePushToken);
userRouter.delete("/push-token", verifyToken, deletePushToken);
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