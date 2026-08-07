"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const User = require("../models/User");
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const ForumPost = require("../models/ForumPost");
const StrayReport = require("../models/strayreport");
const RescueHistory = require("../models/RescueHistory");
const RescueRequest = require("../models/RescueRequest");
const UserReport = require("../models/UserReport");
const mongoose_1 = __importDefault(require("mongoose"));
const ProfileStatsService_1 = require("../services/ProfileStatsService");
const NotificationService_1 = require("../services/NotificationService");
const PrivacyService_1 = __importDefault(require("../services/PrivacyService"));
// Fetch another user's public profile data (safe, sanitised)
exports.getPublicProfile = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ message: "Invalid user ID format" });
        return;
    }
    const user = await User.findById(userId).select("-password -email -phone").lean();
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const { profileData, stats } = await ProfileStatsService_1.ProfileStatsService.getProfileAndStats(userId, user.role);
    const messagePermission = await PrivacyService_1.default.canMessage(currentUserId, userId);
    const callPermission = await PrivacyService_1.default.canCall(currentUserId, userId);
    res.status(200).json({
        user: {
            id: user._id,
            name: user.name,
            role: user.role,
            isApproved: user.isApproved,
            createdAt: user.createdAt,
        },
        profile: profileData,
        stats,
        permissions: {
            canMessage: messagePermission.allowed,
            canCall: callPermission.allowed,
        }
    });
});
;
// Update Privacy Settings
exports.updatePrivacySettings = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { messagingPrivacy, callingPrivacy } = req.body;
    const currentUserId = req.user.id;
    const validOptions = ["everyone", "contacts", "relatedOnly", "none"];
    if (messagingPrivacy && !validOptions.includes(messagingPrivacy)) {
        res.status(400).json({ message: "Invalid messaging privacy option" });
        return;
    }
    if (callingPrivacy && !validOptions.includes(callingPrivacy)) {
        res.status(400).json({ message: "Invalid calling privacy option" });
        return;
    }
    const updates = {};
    if (messagingPrivacy)
        updates.messagingPrivacy = messagingPrivacy;
    if (callingPrivacy)
        updates.callingPrivacy = callingPrivacy;
    const updatedUser = await User.findByIdAndUpdate(currentUserId, { $set: updates }, { new: true, runValidators: true }).select("-password").lean();
    res.status(200).json({
        message: "Privacy settings updated successfully",
        user: updatedUser
    });
});
;
// Fetch user's posts
exports.getUserPosts = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { userId } = req.params;
    const posts = await ForumPost.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(posts);
});
;
// Fetch user's reports (public reports only, or all if requesting user is self)
exports.getUserReports = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { userId } = req.params;
    // Check if the requesting user is self to include anonymous reports
    const authHeader = req.headers["authorization"];
    let isSelf = false;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const jwt = require("jsonwebtoken");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.id === userId) {
                isSelf = true;
            }
        }
        catch (err) {
            // Ignore token verification errors
        }
    }
    const query = { reporterUserId: userId };
    if (!isSelf) {
        query.anonymous = false;
    }
    const reports = await StrayReport.find(query).sort({ createdAt: -1 });
    res.status(200).json(reports);
});
;
// Create a report against a user
exports.createUserReport = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { reportedUserId, reason, description } = req.body;
    const reporterUserId = req.user.id; // From verifyToken
    if (!reportedUserId || !reason || !description) {
        res.status(400).json({ message: "All fields are required" });
        return;
    }
    if (description.length < 20) {
        res.status(400).json({ message: "Description must be at least 20 characters long" });
        return;
    }
    const newReport = await UserReport.create({
        reportedUserId,
        reporterUserId,
        reason,
        description,
        status: "Pending",
    });
    res.status(201).json({
        message: "Report submitted successfully",
        report: newReport,
    });
});
;
// Admin endpoint to view user reports
exports.getUserReportsAdmin = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    // Note: In a real system, you would check if req.user.role === 'admin'
    const reports = await UserReport.find()
        .populate("reportedUserId", "name email role")
        .populate("reporterUserId", "name email role")
        .sort({ createdAt: -1 });
    res.status(200).json(reports);
});
;
// Helper to get and cache profile image
const getProfileImageForUser = async (uId, role) => {
    try {
        let profile = null;
        if (role === "general_user") {
            profile = await GeneralUserProfile.findOne({ userId: uId }).lean();
        }
        else if (role === "volunteer") {
            profile = await VolunteerProfile.findOne({ userId: uId }).lean();
        }
        else if (role === "ngo") {
            profile = await NGOProfile.findOne({ userId: uId }).lean();
        }
        else if (role === "vet") {
            profile = await VetProfile.findOne({ userId: uId }).lean();
        }
        return profile?.profileImage || "";
    }
    catch (err) {
        console.error(`Error in getProfileImageForUser helper:`, err);
        return "";
    }
};
// Search registered users by name or email (username), excluding current logged-in user
exports.searchUsers = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const currentUserId = req.user.id;
    const { query = "" } = req.query;
    if (!query.trim()) {
        res.status(200).json([]);
        return;
    }
    const users = await User.find({
        _id: { $ne: currentUserId },
        $and: [
            {
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { email: { $regex: query, $options: "i" } },
                ],
            },
            {
                $or: [
                    { role: { $nin: ["ngo", "vet"] } },
                    { isApproved: true }
                ]
            }
        ]
    })
        .select("name email role profileCompleted profileImage avatar")
        .limit(20)
        .lean();
    // Attach permissions & Self-healing check
    const processedUsers = await Promise.all(users.map(async (u) => {
        if (!u.profileImage) {
            u.profileImage = u.avatar || "";
        }
        const messagePermission = await PrivacyService_1.default.canMessage(currentUserId, u._id.toString());
        const callPermission = await PrivacyService_1.default.canCall(currentUserId, u._id.toString());
        return {
            ...u,
            permissions: {
                canMessage: messagePermission.allowed,
                canCall: callPermission.allowed
            }
        };
    }));
    res.status(200).json(processedUsers);
});
;
// Admin endpoint to approve a user account (NGO / Vet)
exports.approveUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    if (req.user.role !== "admin") {
        res.status(403).json({ message: "Access denied. Admins only." });
        return;
    }
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    if (user.isApproved) {
        res.status(400).json({ message: "User is already approved" });
        return;
    }
    user.isApproved = true;
    await user.save();
    // Update profile status as well
    if (user.role === "ngo") {
        await NGOProfile.findOneAndUpdate({ userId: user._id }, { status: "Verified" });
    }
    else if (user.role === "vet") {
        await VetProfile.findOneAndUpdate({ userId: user._id }, { status: "Verified" });
    }
    // Create in-app success notification
    await NotificationService_1.NotificationService.sendNotification(user._id, "Profile Updated", "Your profile has been updated successfully", "success");
    // Emit real-time update via Socket.IO
    const io = req.app.get("io");
    if (io) {
        io.of("/chat").to(`user:${user._id}`).emit("user:approved", {
            notification: {
                title: "Profile Updated",
                message: "Your profile has been updated successfully",
                type: "success"
            },
        });
    }
    res.status(200).json({
        message: "User approved successfully",
        user: {
            id: user._id,
            name: user.name,
            role: user.role,
            isApproved: user.isApproved,
        },
    });
});
;
// Store push notification token for user
exports.savePushToken = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = req.user?.id;
    const { pushToken } = req.body;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized. Please login first." });
        return;
    }
    if (!pushToken) {
        res.status(400).json({ message: "pushToken is required" });
        return;
    }
    try {
        const user = await User.findByIdAndUpdate(userId, { pushToken }, { new: true }).select("name email pushToken");
        console.log(`[PUSH] Push token saved for user ${userId}`);
        res.status(200).json({
            message: "Push token saved successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
        });
    }
    catch (error) {
        console.error("[PUSH] Error saving push token:", error);
        next(error);
    }
});
// Remove push notification token for user (opt-out)
exports.deletePushToken = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized. Please login first." });
        return;
    }
    try {
        const user = await User.findByIdAndUpdate(userId, { $unset: { pushToken: 1 } }, { new: true });
        console.log(`[PUSH] Push token removed for user ${userId}`);
        res.status(200).json({ message: "Push token removed successfully" });
    }
    catch (error) {
        console.error("[PUSH] Error removing push token:", error);
        next(error);
    }
});
//# sourceMappingURL=userController.js.map