const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Notification = require("../models/Notification");
const NGOProfile = require("../models/NGOProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const GeneralUserProfile = require("../models/GeneralUserProfile");

const generateToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const register = async (req, res, next) => {
  let user;
  try {
    const { name, email, phone, password } = req.body;

    console.log("Register request received for:", req.body.email);

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
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

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
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
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    next(error);
  }
};

const selectRole = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { role } = req.body;

    const allowedRoles = ["general_user", "volunteer", "ngo", "vet"];

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
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

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

module.exports = {
  register,
  login,
  selectRole,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
};