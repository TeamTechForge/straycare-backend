const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const admin = require("../config/firebase");
const User = require("../models/User");
const Notification = require("../models/Notification");
const NGOProfile = require("../models/NGOProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const GeneralUserProfile = require("../models/GeneralUserProfile");

import type { Request, Response, NextFunction } from "express";

const generateToken = (userId: string, role: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let user: any;
  try {
    const { name, email, phone, password } = req.body;

    console.log("Register request received for:", req.body.email);

    if (!name || !email || !phone || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "general_user",
    });

    const token = generateToken(user._id, user.role);

    try {
      await Notification.create({
        userId: user._id,
        title: "Welcome to StrayCare!",
        message: `Hi ${name}, welcome to our community! Together we can save more stray animals. 🐾`,
        type: "welcome",
      });
    } catch (notificationError) {
      console.error("Notification creation failed gracefully:", notificationError);
    }

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileCompleted: user.profileCompleted,
        roleSelected: user.roleSelected,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (user && user._id) {
      try {
        await User.findByIdAndDelete(user._id);
        console.log(`Rolled back user creation for ID: ${user._id}`);
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
    }

    next(error);
  }
};

const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileCompleted: user.profileCompleted,
        roleSelected: user.roleSelected,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    next(error);
  }
};

const selectRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { role } = req.body;

    const allowedRoles = ["general_user", "volunteer", "ngo", "vet"];

    if (!role) {
      res.status(400).json({ message: "Role is required" });
      return;
    }

    if (!allowedRoles.includes(role)) {
      res.status(400).json({ message: "Invalid role selected" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role, roleSelected: true },
      { new: true }
    ).select("-password");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "Role updated successfully",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user: any = await User.findById(req.user!.id).select("-password").lean();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role === "ngo") {
      const ngoProfile = await NGOProfile.findOne({ userId: user._id });
      if (ngoProfile) {
        user.organizationName = ngoProfile.orgName;
      }
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;

    await user.save();

    res.status(200).json({
      message: "Reset token generated successfully",
      resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken,
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      res.status(401).json({ message: "Incorrect current password" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role === "ngo") {
      await NGOProfile.findOneAndDelete({ userId });
    } else if (user.role === "volunteer") {
      await VolunteerProfile.findOneAndDelete({ userId });
    } else if (user.role === "vet") {
      await VetProfile.findOneAndDelete({ userId });
    } else if (user.role === "general_user") {
      await GeneralUserProfile.findOneAndDelete({ userId });
    }

    await User.findByIdAndDelete(userId);

    await Notification.deleteMany({ userId });

    res.status(200).json({ message: "Account and associated data deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ message: "Firebase ID token is required" });
      return;
    }

    // Verify the Firebase ID token
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      console.error("Firebase token verification failed:", error.message);
      res.status(401).json({ message: "Invalid or expired Firebase token" });
      return;
    }

    const { uid, email, name: displayName, picture } = decodedToken;

    if (!email) {
      res.status(400).json({
        message: "Google account does not have an email address.",
      });
      return;
    }

    // Check if user already exists by email
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Existing user — update googleId and avatar if not already set
      if (!user.googleId) user.googleId = uid;
      if (!user.avatar && picture) user.avatar = picture;
      await user.save();
    } else {
      // New user — create account
      isNewUser = true;
      user = await User.create({
        name: displayName || email.split("@")[0],
        email,
        googleId: uid,
        authProvider: "google",
        avatar: picture || "",
        role: "general_user",
      });

      // Welcome notification
      try {
        await Notification.create({
          userId: user._id,
          title: "Welcome to StrayCare!",
          message: `Hi ${user.name}, welcome to our community! Together we can save more stray animals. 🐾`,
          type: "welcome",
        });
      } catch (notificationError) {
        console.error("Notification creation failed gracefully:", notificationError);
      }
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        profileCompleted: user.profileCompleted,
        isApproved: user.isApproved,
      },
      isNewUser,
    });
  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  selectRole,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
};
