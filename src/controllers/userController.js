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
const Notification = require("../models/Notification");

// Fetch another user's public profile data (safe, sanitised)
exports.getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password -email -phone").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData = {};
    let stats = {};

    // Base stats common to all users
    const postCount = await ForumPost.countDocuments({ userId });
    stats.postsCount = postCount;

    if (user.role === "general_user") {
      const generalProfile = await GeneralUserProfile.findOne({ userId }).lean() || {};
      const reportCount = await StrayReport.countDocuments({ reporterUserId: userId });
      
      profileData = {
        location: generalProfile.location || "",
        bio: generalProfile.bio || "",
        profileImage: generalProfile.profileImage || "",
      };
      
      stats.reportsCount = reportCount;

    } else if (user.role === "volunteer") {
      const volunteerProfile = await VolunteerProfile.findOne({ userId }).lean() || {};
      const Rescuer = require("../models/Rescuer");
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const totalRescues = await RescueHistory.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
      });
      const activeRescues = await RescueRequest.countDocuments({ 
        rescuerId: rescuerIdQuery, 
        status: { $in: ["accepted", "under_rescue"] } 
      });
      
      // Calculate completion rate based on history vs total attempts (completed + rejected)
      const totalAttempts = await RescueRequest.countDocuments({ rescuerId: rescuerIdQuery });
      const completionRate = totalAttempts > 0 ? Math.round((totalRescues / totalAttempts) * 100) : 100;

      profileData = {
        location: volunteerProfile.location || "",
        bio: volunteerProfile.bio || "",
        profileImage: volunteerProfile.profileImage || "",
        serviceArea: volunteerProfile.serviceArea || "",
        rescueCompletionRate: completionRate,
      };

      stats.rescuesCompleted = totalRescues + activeRescues;
      stats.activeRescues = activeRescues;

    } else if (user.role === "vet") {
      const vetProfile = await VetProfile.findOne({ userId }).lean() || {};
      const Rescuer = require("../models/Rescuer");
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const totalRescues = await RescueHistory.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
      });
      const activeRescues = await RescueRequest.countDocuments({ 
        rescuerId: rescuerIdQuery, 
        status: { $in: ["accepted", "under_rescue"] } 
      });

      profileData = {
        location: vetProfile.primaryLocation || "",
        bio: vetProfile.bio || "",
        profileImage: vetProfile.profileImage || "",
        clinicName: vetProfile.clinicName || "",
        clinicAddress: vetProfile.clinicAddress || "",
        specialization: vetProfile.specialization || "",
        animalsTreated: vetProfile.animalsTreated || 0,
        emergencyAvailability: vetProfile.emergencyAvailability || false,
      };

      stats.rescuesCompleted = totalRescues + activeRescues;
      stats.animalsTreated = vetProfile.animalsTreated || 0;

    } else if (user.role === "ngo") {
      const ngoProfile = await NGOProfile.findOne({ userId }).lean() || {};
      const Rescuer = require("../models/Rescuer");
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const totalRescues = await RescueHistory.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
      });
      const activeRescues = await RescueRequest.countDocuments({ 
        rescuerId: rescuerIdQuery, 
        status: { $in: ["accepted", "under_rescue"] } 
      });

      profileData = {
        location: ngoProfile.location || "",
        bio: ngoProfile.bio || "",
        profileImage: ngoProfile.profileImage || "",
        orgName: ngoProfile.orgName || "",
        totalAdoptions: ngoProfile.totalAdoptions || 0,
        donationCampaignCount: ngoProfile.donationCampaignCount || 0,
      };

      stats.rescuesCompleted = totalRescues + activeRescues;
      stats.totalAdoptions = ngoProfile.totalAdoptions || 0;
      stats.donationCampaignCount = ngoProfile.donationCampaignCount || 0;
    }

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
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch public profile",
      error: error.message,
    });
  }
};

// Fetch user's posts
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const posts = await ForumPost.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch user posts",
      error: error.message,
    });
  }
};

// Fetch user's reports (public reports only, or all if requesting user is self)
exports.getUserReports = async (req, res) => {
  try {
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
      } catch (err) {
        // Ignore token verification errors
      }
    }

    const query = { reporterUserId: userId };
    if (!isSelf) {
      query.anonymous = false;
    }

    const reports = await StrayReport.find(query).sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch user reports",
      error: error.message,
    });
  }
};

// Create a report against a user
exports.createUserReport = async (req, res) => {
  try {
    const { reportedUserId, reason, description } = req.body;
    const reporterUserId = req.user.id; // From verifyToken

    if (!reportedUserId || !reason || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (description.length < 20) {
      return res.status(400).json({ message: "Description must be at least 20 characters long" });
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
  } catch (error) {
    res.status(500).json({
      message: "Failed to submit user report",
      error: error.message,
    });
  }
};

// Admin endpoint to view user reports
exports.getUserReportsAdmin = async (req, res) => {
  try {
    // Note: In a real system, you would check if req.user.role === 'admin'
    const reports = await UserReport.find()
      .populate("reportedUserId", "name email role")
      .populate("reporterUserId", "name email role")
      .sort({ createdAt: -1 });
      
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

// Helper to get and cache profile image
const getProfileImageForUser = async (uId, role) => {
  try {
    let profile = null;
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
    console.error(`Error in getProfileImageForUser helper:`, err);
    return "";
  }
};

// Search registered users by name or email (username), excluding current logged-in user
exports.searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { query = "" } = req.query;

    if (!query.trim()) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .select("name email role profileCompleted profileImage")
      .limit(20)
      .lean();

    // Self-healing check
    for (let u of users) {
      if (u.profileImage === undefined || u.profileImage === null) {
        u.profileImage = await getProfileImageForUser(u._id, u.role);
        await User.findByIdAndUpdate(u._id, { profileImage: u.profileImage });
      }
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Failed to search users",
      error: error.message,
    });
  }
};

// Admin endpoint to approve a user account (NGO / Vet)
exports.approveUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isApproved) {
      return res.status(400).json({ message: "User is already approved" });
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
    const notification = await Notification.create({
      userId: user._id,
      title: "Account Verified!",
      message: "Congratulations! Your account verification is complete. You now have full access to StrayCare features. 🐾",
      type: "success",
    });

    // Emit real-time update via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.of("/chat").to(`user:${user._id}`).emit("user:approved", {
        message: "Your account has been verified",
        notification,
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
  } catch (error) {
    res.status(500).json({
      message: "Failed to approve user",
      error: error.message,
    });
  }
};
