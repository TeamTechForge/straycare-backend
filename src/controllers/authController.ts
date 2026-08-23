import { catchAsync } from "../utils/catchAsync";
const crypto = require("crypto");
const admin = require("../config/firebase");
const User = require("../models/User");
const NGOProfile = require("../models/NGOProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const GeneralUserProfile = require("../models/GeneralUserProfile");

import { Role } from "../enums/Role.enum";
import { AuthValidator } from "../validators/authValidator";
import { JwtService } from "../services/jwtService";
import { PasswordService } from "../services/passwordService";
import { NotificationService } from "../services/notificationService";
const { sendPasswordResetCodeEmail } = require("../utils/emailService");
import type { Request, Response, NextFunction } from "express";
const Notification = require("../models/Notification");

/**
 * Handles Registration
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let user: any;
  try {
    const { name, email, phone, password } = req.body;

    console.log("Register request received for:", req.body.email);

    // Validate the registration data before creating the account.
    const validation = AuthValidator.validateRegistrationPayload(req.body);
    if (!validation.isValid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }
    // Hash the password before storing it in the database.
    const hashedPassword = await PasswordService.hashPassword(password, 10);

    user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: Role.GENERAL_USER,
    });

    // Generate a JWT for the newly registered user.
    const token = JwtService.generateToken({ id: user._id, role: user.role });

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

/**
 * Handles Login
 */
const login = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

  // Compare the entered password with the stored hashed password.
  const isMatch = await PasswordService.comparePassword(password, user.password);

  if (!isMatch) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  // Check whether the user's account has been suspended or warned.
  let accountStatus: string | null = user.accountStatus || null;

  if (user.role === "vet") {
    const vetProfile = await VetProfile.findOne({ userId: user._id });
    if (vetProfile?.accountStatus) accountStatus = vetProfile.accountStatus;
  } else if (user.role === "ngo") {
    const ngoProfile = await NGOProfile.findOne({ userId: user._id });
    if (ngoProfile?.accountStatus) accountStatus = ngoProfile.accountStatus;
  } else if (user.role === "volunteer") {
    const volunteerProfile = await VolunteerProfile.findOne({ userId: user._id });
    if (volunteerProfile?.accountStatus) accountStatus = volunteerProfile.accountStatus;
  }

  if (accountStatus === "Suspended") {
    res.status(403).json({ message: "Your account has been suspended." });
    return;
  }

  // Generate a JWT after successful authentication.
  const token = JwtService.generateToken({ id: user._id, role: user.role });

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
    ...(accountStatus === "Warned" && {
      warning: "Your account has received a warning due to a reported issue. Please be mindful of community guidelines going forward.",
    }),
  });
});

const selectRole = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const { role } = req.body;

  const allowedRoles = ["general_user", "volunteer", "ngo", "vet"];

  if (!role) {
    res.status(400).json({ message: "Role is required" });
    return;
  }

  // Allow only the roles supported by the application.
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

  // Generate a new token containing the user's updated role.
  const token = JwtService.generateToken({ id: user._id, role: user.role });

  res.status(200).json({
    message: "Role updated successfully",
    token,
    user,
  });
});

const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Retrieve the authenticated user's data without exposing the password
  const user: any = await User.findById(req.user!.id).select("-password").lean();
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Add NGO-specific profile information when applicable.
  if (user.role === "ngo") {
    const ngoProfile = await NGOProfile.findOne({ userId: user._id });
    if (ngoProfile) {
      user.organizationName = ngoProfile.orgName;
    }
  }

  res.status(200).json(user);
});

/**
 * Handles Forgot Password
 */
const forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Generate a 6-digit code

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  // Store only a hashed version of the reset code.
  const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

  if (user) {
    user.resetPasswordToken = hashedCode;
    user.resetPasswordExpires = Date.now() + 900000; // 15 minutes
    await user.save();

    try {
      await sendPasswordResetCodeEmail(user.email, resetCode);
    } catch (err) {
      console.error("Error sending reset email:", err);
    }
  }

  // Always return 200 to prevent user enumeration
  res.status(200).json({
    message: "If this email is registered, a 6-digit reset code has been sent.",
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { token, newPassword } = req.body;
  // Hash the submitted code so it can be compared with the stored hash.
  const hashedCode = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedCode,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400).json({ message: "Invalid or expired reset code" });
    return;
  }

  const hashedPassword = await PasswordService.hashPassword(newPassword, 10);
  user.password = hashedPassword;
  // Clear the reset credentials so the code cannot be reused.
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password reset successful" });
});

/**
 * Handles Change Password
 */
const changePassword = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  const user = await User.findById(userId);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const isMatch = await PasswordService.comparePassword(currentPassword, user.password);

  if (!isMatch) {
    res.status(401).json({ message: "Incorrect current password" });
    return;
  }

  const hashedPassword = await PasswordService.hashPassword(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  res.status(200).json({ message: "Password updated successfully" });
});

/**
 * Handles Delete Account
 *
 * Requires re-authentication before deletion:
 * - local users:  must supply their current password in req.body.password
 * - google users: must supply a fresh Firebase ID token in req.body.googleCredential
 *
 * The backend determines which verification to apply by reading
 * user.authProvider from the database. The client cannot influence this.
 */
const deleteAccount = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;

  // Fetch the user with the password hash included so we can verify it.
  const user = await User.findById(userId).select("+password");

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // ── Identity verification ────────────────────────────────────────────────
  // The provider is read from the database, not from the request body.
  // A google user cannot bypass this by sending { "password": "..." }.

  if (user.authProvider === "local" || !user.authProvider) {
    // ── Email / password users ──────────────────────────────────────────────
    const { password } = req.body;

    if (!password || typeof password !== "string" || password.trim() === "") {
      res.status(400).json({ message: "Password is required to delete your account" });
      return;
    }

    // user.password may be undefined for very old records that had no password set.
    if (!user.password) {
      res.status(400).json({ message: "Account has no password set. Contact support." });
      return;
    }

    const isMatch = await PasswordService.comparePassword(password, user.password);
    // Do not log the supplied password under any circumstances.
    if (!isMatch) {
      res.status(401).json({ message: "Incorrect password. Account not deleted." });
      return;
    }

  } else if (user.authProvider === "google") {
    // ── Google users ────────────────────────────────────────────────────────
    const { googleCredential } = req.body;

    if (!googleCredential || typeof googleCredential !== "string" || googleCredential.trim() === "") {
      res.status(400).json({ message: "Google credential is required to delete your account" });
      return;
    }

    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(googleCredential);
    } catch (err: any) {
      res.status(401).json({ message: "Invalid or expired Google credential. Please sign in with Google again." });
      return;
    }

    // The UID from the verified token must match what is stored in the database.
    const firebaseUid: string | undefined = decodedToken.uid || decodedToken.sub;
    if (!firebaseUid || firebaseUid !== user.googleId) {
      res.status(401).json({ message: "Google account does not match. Account not deleted." });
      return;
    }

  } else {
    res.status(400).json({ message: "Unsupported authentication provider" });
    return;
  }

  // ── Deletion (existing logic — unchanged) ────────────────────────────────
  // Delete the role-specific profile before removing the main user account.
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

  // Remove notifications associated with the deleted account.
  await Notification.deleteMany({ userId });

  res.status(200).json({ message: "Account and associated data deleted successfully" });
});


/**
 * Handles Google Authentication
 */
const googleAuth = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    // Existing user - update googleId and avatar if not already set
    if (!user.googleId) user.googleId = uid;
    if (!user.avatar && picture) user.avatar = picture;
    await user.save();
  } else {
    // New user - create account
    isNewUser = true;
    user = await User.create({
      name: displayName || email.split("@")[0],
      email,
      googleId: uid,
      authProvider: "google",
      avatar: picture || "",
      role: "general_user",
    });
  }
  // Generate a StrayCare JWT for the authenticated Google user.
  const token = JwtService.generateToken({ id: user._id, role: user.role });

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
});

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
