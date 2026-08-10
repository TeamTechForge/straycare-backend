"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const crypto = require("crypto");
const admin = require("../config/firebase");
const User = require("../models/User");
const NGOProfile = require("../models/NGOProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const GeneralUserProfile = require("../models/GeneralUserProfile");
const Role_enum_1 = require("../enums/Role.enum");
const authValidator_1 = require("../validators/authValidator");
const jwtService_1 = require("../services/jwtService");
const passwordService_1 = require("../services/passwordService");
const notificationService_1 = require("../services/notificationService");
const { sendPasswordResetCodeEmail } = require("../utils/emailService");
const Notification = require("../models/Notification");
const register = async (req, res, next) => {
    let user;
    try {
        const { name, email, phone, password } = req.body;
        console.log("Register request received for:", req.body.email);
        const validation = authValidator_1.AuthValidator.validateRegistrationPayload(req.body);
        if (!validation.isValid) {
            res.status(400).json({ message: validation.message });
            return;
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "Email already registered" });
            return;
        }
        const hashedPassword = await passwordService_1.PasswordService.hashPassword(password, 10);
        user = await User.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: Role_enum_1.Role.GENERAL_USER,
        });
        const token = jwtService_1.JwtService.generateToken({ id: user._id, role: user.role });
        await notificationService_1.NotificationService.sendNotification(String(user._id), "Welcome to StrayCare!", `Hi ${name}, welcome to our community! Together we can save more stray animals. ðŸ¾`, "welcome");
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
    }
    catch (error) {
        console.error("REGISTER ERROR:", error);
        if (user && user._id) {
            try {
                await User.findByIdAndDelete(user._id);
                console.log(`Rolled back user creation for ID: ${user._id}`);
            }
            catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }
        }
        next(error);
    }
};
exports.register = register;
const login = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
    const isMatch = await passwordService_1.PasswordService.comparePassword(password, user.password);
    if (!isMatch) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    // ── Check account status (Suspended / Warned) ──────────────
    let accountStatus = user.accountStatus || null;
    if (user.role === "vet") {
        const vetProfile = await VetProfile.findOne({ userId: user._id });
        if (vetProfile?.accountStatus)
            accountStatus = vetProfile.accountStatus;
    }
    else if (user.role === "ngo") {
        const ngoProfile = await NGOProfile.findOne({ userId: user._id });
        if (ngoProfile?.accountStatus)
            accountStatus = ngoProfile.accountStatus;
    }
    else if (user.role === "volunteer") {
        const volunteerProfile = await VolunteerProfile.findOne({ userId: user._id });
        if (volunteerProfile?.accountStatus)
            accountStatus = volunteerProfile.accountStatus;
    }
    if (accountStatus === "Suspended") {
        res.status(403).json({ message: "Your account has been suspended." });
        return;
    }
    const token = jwtService_1.JwtService.generateToken({ id: user._id, role: user.role });
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
const selectRole = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = req.user.id;
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
    const user = await User.findByIdAndUpdate(userId, { role, roleSelected: true }, { new: true }).select("-password");
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const token = jwtService_1.JwtService.generateToken({ id: user._id, role: user.role });
    res.status(200).json({
        message: "Role updated successfully",
        token,
        user,
    });
});
const getMe = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const user = await User.findById(req.user.id).select("-password").lean();
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
});
const forgotPassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Generate a 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');
    if (user) {
        user.resetPasswordToken = hashedCode;
        user.resetPasswordExpires = Date.now() + 900000; // 15 minutes
        await user.save();
        try {
            await sendPasswordResetCodeEmail(user.email, resetCode);
        }
        catch (err) {
            console.error("Error sending reset email:", err);
        }
    }
    // Always return 200 to prevent user enumeration
    res.status(200).json({
        message: "If this email is registered, a 6-digit reset code has been sent.",
    });
});
const resetPassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { token, newPassword } = req.body;
    const hashedCode = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedCode,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        res.status(400).json({ message: "Invalid or expired reset code" });
        return;
    }
    const hashedPassword = await passwordService_1.PasswordService.hashPassword(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.status(200).json({ message: "Password reset successful" });
});
const changePassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const isMatch = await passwordService_1.PasswordService.comparePassword(currentPassword, user.password);
    if (!isMatch) {
        res.status(401).json({ message: "Incorrect current password" });
        return;
    }
    const hashedPassword = await passwordService_1.PasswordService.hashPassword(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.status(200).json({ message: "Password updated successfully" });
});
const deleteAccount = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    if (user.role === "ngo") {
        await NGOProfile.findOneAndDelete({ userId });
    }
    else if (user.role === "volunteer") {
        await VolunteerProfile.findOneAndDelete({ userId });
    }
    else if (user.role === "vet") {
        await VetProfile.findOneAndDelete({ userId });
    }
    else if (user.role === "general_user") {
        await GeneralUserProfile.findOneAndDelete({ userId });
    }
    await User.findByIdAndDelete(userId);
    await Notification.deleteMany({ userId });
    res.status(200).json({ message: "Account and associated data deleted successfully" });
});
const googleAuth = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { idToken } = req.body;
    if (!idToken) {
        res.status(400).json({ message: "Firebase ID token is required" });
        return;
    }
    // Verify the Firebase ID token
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    }
    catch (error) {
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
        // Existing user â€” update googleId and avatar if not already set
        if (!user.googleId)
            user.googleId = uid;
        if (!user.avatar && picture)
            user.avatar = picture;
        await user.save();
    }
    else {
        // New user â€” create account
        isNewUser = true;
        user = await User.create({
            name: displayName || email.split("@")[0],
            email,
            googleId: uid,
            authProvider: "google",
            avatar: picture || "",
            role: "general_user",
        });
        await notificationService_1.NotificationService.sendNotification(String(user._id), "Welcome to StrayCare!", `Hi ${user.name}, welcome to our community! Together we can save more stray animals. ðŸ¾`, "welcome");
    }
    const token = jwtService_1.JwtService.generateToken({ id: user._id, role: user.role });
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
    register: exports.register,
    login,
    googleAuth,
    selectRole,
    getMe,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount,
};
//# sourceMappingURL=authController.js.map