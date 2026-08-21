import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ProfileStatsService } from "../services/profileStatsService";
import { NotificationService } from "../services/notificationService";
import PrivacyService from "../services/privacyService";
import { Logger } from "../utils/logger";

const User = require("../models/User");
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const ForumPost = require("../models/ForumPost");
const CommunityPost = require("../models/CommunityPost").default || require("../models/CommunityPost");
const CommunityLike = require("../models/CommunityLike").default || require("../models/CommunityLike");
const CommunityComment = require("../models/CommunityComment").default || require("../models/CommunityComment");
const StrayReport = require("../models/StrayReport");
const RescueHistory = require("../models/RescueHistory");
const RescueRequest = require("../models/RescueRequest");
const UserReport = require("../models/UserReport");

/**
 * GET PUBLIC PROFILE
 * Fetches a user's sanitized public profile data, role statistics, block status, and message/call privacy permissions.
 */
exports.getPublicProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId } = req.params;
  const currentUserId = req.user!.id;

  if (!mongoose.Types.ObjectId.isValid(userId as string)) {
    res.status(400).json({ message: "Invalid user ID format" });
    return;
  }
  const user: any = await User.findById(userId).select("-password -email -phone").lean();

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const isSelf = String(currentUserId) === String(userId);

  if (!isSelf && user.blockedUsers && user.blockedUsers.map((id: any) => id.toString()).includes(String(currentUserId))) {
    res.status(403).json({ message: "You are not authorized to view this profile." });
    return;
  }

  const { profileData, stats } = await ProfileStatsService.getProfileAndStats(userId as string, user.role, isSelf);

  const messagePermission = await PrivacyService.canMessage(currentUserId, userId as string);
  const callPermission = await PrivacyService.canCall(currentUserId, userId as string);

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
    },
  });
});

/**
 * UPDATE PRIVACY SETTINGS
 * Updates the user's messaging and calling privacy filters ("everyone", "contacts", "relatedOnly", "none").
 */
exports.updatePrivacySettings = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { messagingPrivacy, callingPrivacy } = req.body;
  const currentUserId = req.user!.id;

  const validOptions = ["everyone", "contacts", "relatedOnly", "none"];

  if (messagingPrivacy && !validOptions.includes(messagingPrivacy)) {
    res.status(400).json({ message: "Invalid messaging privacy option" });
    return;
  }

  if (callingPrivacy && !validOptions.includes(callingPrivacy)) {
    res.status(400).json({ message: "Invalid calling privacy option" });
    return;
  }

  const updates: any = {};
  if (messagingPrivacy) updates.messagingPrivacy = messagingPrivacy;
  if (callingPrivacy) updates.callingPrivacy = callingPrivacy;

  const updatedUser = await User.findByIdAndUpdate(
    currentUserId,
    { $set: updates },
    { new: true, runValidators: true }
  ).select("-password").lean();

  res.status(200).json({
    message: "Privacy settings updated successfully",
    user: updatedUser,
  });
});

/**
 * TOGGLE BLOCK USER
 * Blocks or unblocks a target user account by updating the requesting user's blockedUsers list.
 */
exports.toggleBlockUser = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const currentUserId = req.user!.id;
  const targetUserId = req.params.id as string;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    res.status(400).json({ message: "Invalid user ID format" });
    return;
  }

  if (currentUserId === targetUserId) {
    res.status(400).json({ message: "You cannot block yourself" });
    return;
  }

  const currentUser = await User.findById(currentUserId);
  if (!currentUser) {
    res.status(404).json({ message: "Current user not found" });
    return;
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    res.status(404).json({ message: "Target user not found" });
    return;
  }

  const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.includes(targetUserId);

  let updateOp;
  let statusMessage;

  if (isBlocked) {
    updateOp = { $pull: { blockedUsers: targetUserId } };
    statusMessage = "User unblocked successfully";
  } else {
    updateOp = { $addToSet: { blockedUsers: targetUserId } };
    statusMessage = "User blocked successfully";
  }

  await User.findByIdAndUpdate(currentUserId, updateOp);

  res.status(200).json({ message: statusMessage, isBlocked: !isBlocked });
});

/**
 * GET USER POSTS
 * Retrieves both community posts and forum posts authored by the specified user.
 */
exports.getUserPosts = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId } = req.params;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId as string)) {
    res.status(400).json({ message: "Invalid user ID format" });
    return;
  }

  const [forumPosts, communityPosts] = await Promise.all([
    ForumPost.find({ userId }).sort({ createdAt: -1 }).lean(),
    CommunityPost.find({ authorUserId: userId }).sort({ submittedAt: -1, createdAt: -1 }).lean(),
  ]);

  const formattedCommunityPosts = await Promise.all(
    communityPosts.map(async (p: any) => {
      const [likeCount, commentCount] = await Promise.all([
        CommunityLike.countDocuments({ postId: p._id }),
        CommunityComment.countDocuments({ postId: p._id }),
      ]);

      return {
        _id: String(p._id),
        title: p.title || "Community Post",
        tag: p.category || "Community",
        author: p.username || "User",
        imageUrl: p.imageUrl || null,
        likes: likeCount,
        likeCount: likeCount,
        comments: commentCount,
        commentCount: commentCount,
        createdAt: p.submittedAt || p.createdAt,
      };
    })
  );

  const formattedForumPosts = forumPosts.map((p: any) => ({
    _id: String(p._id),
    title: p.title || "Forum Post",
    tag: p.tag || "General",
    author: p.author || "User",
    imageUrl: p.imageUrl || null,
    likes: p.likes || 0,
    likeCount: p.likes || 0,
    comments: p.commentCount || 0,
    commentCount: p.commentCount || 0,
    createdAt: p.createdAt,
  }));

  const combinedPosts = [...formattedCommunityPosts, ...formattedForumPosts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.status(200).json(combinedPosts);
});

/**
 * GET USER REPORTS
 * Fetches reports filed by a user (excludes anonymous reports if requesting user is not the author).
 */
exports.getUserReports = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId } = req.params;

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
    } catch (_) {
      // Ignore token verification errors
    }
  }

  const query: any = {
    $or: [{ reporterUserId: userId }, { userId: userId }],
  };
  if (!isSelf) {
    query.anonymous = false;
  }

  const reports = await StrayReport.find(query).sort({ createdAt: -1 });
  res.status(200).json(reports);
});

/**
 * CREATE USER REPORT
 * Allows an authenticated user to submit a misconduct report against another user.
 */
exports.createUserReport = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { reportedUserId, reason, description } = req.body;
  const reporterUserId = req.user!.id;

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

/**
 * GET USER REPORTS (ADMIN)
 * Administrative endpoint to view all submitted user misconduct reports with populated user details.
 */
exports.getUserReportsAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const reports = await UserReport.find()
    .populate("reportedUserId", "name email role")
    .populate("reporterUserId", "name email role")
    .sort({ createdAt: -1 });

  res.status(200).json(reports);
});

/** Helper to retrieve profile image for a specific user role profile */
const getProfileImageForUser = async (uId: string, role: string): Promise<string> => {
  try {
    let profile: any = null;
    if (role === "general_user") {
      profile = await GeneralUserProfile.findOne({ userId: uId }).lean();
    } else if (role === "volunteer") {
      profile = await VolunteerProfile.findOne({ userId: uId }).lean();
    } else if (role === "ngo") {
      profile = await NGOProfile.findOne({ userId: uId }).lean();
    } else if (role === "vet") {
      profile = await VetProfile.findOne({ userId: uId }).lean();
    }
    return profile?.profileImage || "";
  } catch (err) {
    Logger.error("Error in getProfileImageForUser helper:", err);
    return "";
  }
};

/**
 * SEARCH USERS
 * Searches registered users by display name, email, or NGO organization name.
 */
exports.searchUsers = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const currentUserId = req.user!.id;
  const { query = "" } = req.query;

  if (!(query as string).trim()) {
    res.status(200).json([]);
    return;
  }

  // 1. Find NGOs matching the orgName query
  const matchingNgos = await NGOProfile.find({ orgName: { $regex: query, $options: "i" } }).select("userId orgName").lean();
  const ngoUserIds = matchingNgos.map((n: any) => n.userId);
  const ngoOrgNameMap = new Map(matchingNgos.map((n: any) => [n.userId.toString(), n.orgName]));

  const users: any[] = await User.find({
    _id: { $ne: currentUserId },
    $or: [
      // Standard user search (exclude NGOs so we don't search NGO owner names)
      {
        $and: [
          { role: { $ne: "ngo" } },
          { name: { $regex: query, $options: "i" } },
          {
            $or: [
              { role: { $nin: ["ngo", "vet"] } },
              { isApproved: true }
            ]
          }
        ]
      },
      // Match NGOs by the IDs we found in NGOProfile
      {
        $and: [
          { role: "ngo" },
          { _id: { $in: ngoUserIds } },
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

    // Override name if it's an NGO
    if (u.role === "ngo" && ngoOrgNameMap.has(u._id.toString())) {
      u.name = ngoOrgNameMap.get(u._id.toString());
    }

    const messagePermission = await PrivacyService.canMessage(currentUserId, u._id.toString());
    const callPermission = await PrivacyService.canCall(currentUserId, u._id.toString());

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

/**
 * APPROVE USER
 * Admin endpoint to approve and verify privileged user accounts (NGO / Vet).
 */
exports.approveUser = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.user!.role !== "admin") {
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
  } else if (user.role === "vet") {
    await VetProfile.findOneAndUpdate({ userId: user._id }, { status: "Verified" });
  }

  // Create in-app success notification
  await NotificationService.sendNotification(user._id, "Profile Updated", "Your profile has been updated successfully", "success");

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

/**
 * SAVE PUSH TOKEN
 * Saves or updates an Expo Push Token for the authenticated user for mobile push notifications.
 */
exports.savePushToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  if (!/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(pushToken)) {
    res.status(400).json({ message: "A valid Expo push token is required" });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { pushToken },
      { new: true }
    ).select("name email pushToken");

    Logger.info(`[PUSH] Push token saved for user ${userId}`);
    res.status(200).json({
      message: "Push token saved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    Logger.error("[PUSH] Error saving push token:", error);
    next(error);
  }
});

/**
 * DELETE PUSH TOKEN
 * Removes the push token for the authenticated user (opts out of push notifications).
 */
exports.deletePushToken = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized. Please login first." });
    return;
  }

  try {
    await User.findByIdAndUpdate(
      userId,
      { $unset: { pushToken: 1 } },
      { new: true }
    );

    Logger.info(`[PUSH] Push token removed for user ${userId}`);
    res.status(200).json({ message: "Push token removed successfully" });
  } catch (error) {
    Logger.error("[PUSH] Error removing push token:", error);
    next(error);
  }
});
