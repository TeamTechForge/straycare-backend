const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const User = require("../models/User");
const Rescuer = require("../models/Rescuer");

import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { NotificationService } from "../services/notificationService";
import { encryptMessage, decryptMessage } from "../services/messageEncryptionService";

function encryptSecret(text: string | undefined): string {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed.ciphertext && parsed.iv) return text;
  } catch (e) {}
  return JSON.stringify(encryptMessage(text));
}

function decryptSecret(text: string | undefined): string {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed.ciphertext && parsed.iv) return decryptMessage(parsed);
  } catch (e) {}
  return text;
}

const createGeneralProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { location, bio, profileImage, name, phone } = req.body;
  const userId = req.user!.id;

  const profile = await GeneralUserProfile.findOneAndUpdate(
    { userId },
    { location, bio, profileImage },
    { new: true, upsert: true, runValidators: true }
  );

  const userUpdates: any = { profileCompleted: true, profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  await NotificationService.sendNotification(
    String(userId),
    "Welcome to StrayCare!",
    `Hi ${name}, welcome to our community! Together we can save more stray animals. 🐾`,
    "welcome"
  );

  res.status(201).json({ message: "General profile created", profile });
});

const createVolunteerProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { location, bio, profileImage, name, phone } = req.body;
  const userId = req.user!.id;

  const profile = await VolunteerProfile.findOneAndUpdate(
    { userId },
    { location, bio, profileImage },
    { new: true, upsert: true, runValidators: true }
  );

  const userUpdates: any = { profileCompleted: true, profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  const user = await User.findById(userId);
  await Rescuer.findOneAndUpdate(
    { userId },
    {
      userId,
      name: user.name,
      phone: phone || user.phone || "",
      avatar: profile.profileImage || "",
      isAvailable: true,
      location: {
        latitude: Number(req.body.latitude) || 6.9271,
        longitude: Number(req.body.longitude) || 79.8612,
      },
    },
    { upsert: true, new: true }
  );

  await NotificationService.sendNotification(
    String(userId),
    "Welcome to StrayCare!",
    `Hi ${user.name}, welcome to our community! Together we can save more stray animals. 🐾`,
    "welcome"
  );

  res.status(201).json({ message: "Volunteer profile created", profile });
});

const createNGOProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    orgName, contactPerson, regNumber, foundedYear, location, bio,
    profileImage, verificationDocument, merchantId, merchantSecret,
    payHereAppId, payHereAppSecret, phone
  } = req.body;
  const userId = req.user!.id;

  const profile = await NGOProfile.findOneAndUpdate(
    { userId },
    {
      orgName,
      contactPerson,
      regNumber,
      foundedYear,
      location,
      bio,
      profileImage,
      verificationDocument,
      merchantId,
      merchantSecret: encryptSecret(merchantSecret),
      payHereAppId: String(payHereAppId || "").trim(),
      payHereAppSecret: encryptSecret(String(payHereAppSecret || "").trim()),
    },
    { new: true, upsert: true, runValidators: true }
  );

  const userUpdates: any = { profileCompleted: true, profileImage: profile.profileImage || "" };
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  const user = await User.findById(userId);
  await Rescuer.findOneAndUpdate(
    { userId },
    {
      userId,
      name: user.name || orgName || "NGO Rescuer",
      phone: phone || user.phone || "",
      avatar: profile.profileImage || "",
      isAvailable: true,
      location: {
        latitude: Number(req.body.latitude) || 6.9271,
        longitude: Number(req.body.longitude) || 79.8612,
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ message: "NGO profile created", profile });
});

const createVetProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    primaryLocation, bio, clinicName, clinicAddress, licenseNumber,
    yearsOfExperience, profileImage, licenseDocument, merchantId,
    merchantSecret, payHereAppId, payHereAppSecret, name, phone
  } = req.body;
  const userId = req.user!.id;

  const profile = await VetProfile.findOneAndUpdate(
    { userId },
    {
      primaryLocation,
      bio,
      clinicName,
      clinicAddress,
      licenseNumber,
      yearsOfExperience,
      profileImage,
      licenseDocument,
      merchantId,
      merchantSecret: encryptSecret(merchantSecret),
      payHereAppId: String(payHereAppId || "").trim(),
      payHereAppSecret: encryptSecret(String(payHereAppSecret || "").trim()),
    },
    { new: true, upsert: true, runValidators: true }
  );

  const userUpdates: any = { profileCompleted: true, profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  const user = await User.findById(userId);
  await Rescuer.findOneAndUpdate(
    { userId },
    {
      userId,
      name: user.name || clinicName || "Vet Rescuer",
      phone: phone || user.phone || "",
      avatar: profile.profileImage || "",
      isAvailable: true,
      location: {
        latitude: Number(req.body.latitude) || 6.9271,
        longitude: Number(req.body.longitude) || 79.8612,
      },
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ message: "Vet profile created", profile });
});

const getMyProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const role = req.user!.role;
  let profile = null;

  if (role === "general_user") {
    profile = await GeneralUserProfile.findOne({ userId });
  } else if (role === "volunteer") {
    profile = await VolunteerProfile.findOne({ userId });
  } else if (role === "ngo") {
    profile = await NGOProfile.findOne({ userId }).select("+payHereAppId +payHereAppSecret");
  } else if (role === "vet") {
    profile = await VetProfile.findOne({ userId }).select("+payHereAppId +payHereAppSecret");
  }

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const safeProfile: any = typeof profile.toObject === "function" ? profile.toObject() : { ...profile };
  if (role === "ngo" || role === "vet") {
    safeProfile.merchantSecret = decryptSecret(safeProfile.merchantSecret);
    safeProfile.recurringPaymentsEnabled = Boolean(
      safeProfile.payHereAppId && safeProfile.payHereAppSecret
    );
    delete safeProfile.payHereAppId;
    delete safeProfile.payHereAppSecret;
  }

  res.status(200).json(safeProfile);
});

const updateGeneralProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const { name, phone, location, bio, profileImage } = req.body;

  const profile = await GeneralUserProfile.findOneAndUpdate(
    { userId },
    { location, bio, profileImage },
    { new: true, runValidators: true, upsert: true }
  );

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const userUpdates: any = { profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  res.status(200).json({ message: "Profile updated successfully", profile });
});

const updateVolunteerProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const { name, phone, location, bio, profileImage, latitude, longitude } = req.body;

  const profile = await VolunteerProfile.findOneAndUpdate(
    { userId },
    { location, bio, profileImage },
    { new: true, runValidators: true, upsert: true }
  );

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const userUpdates: any = { profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  if (latitude !== undefined && longitude !== undefined) {
    const user = await User.findById(userId);
    await Rescuer.findOneAndUpdate(
      { userId },
      {
        userId,
        name: user.name || name || "Volunteer Rescuer",
        phone: user.phone || phone || "",
        avatar: profile.profileImage || "",
        isAvailable: true,
        location: { latitude: Number(latitude), longitude: Number(longitude) }
      },
      { upsert: true }
    );
  }

  res.status(200).json({ message: "Profile updated successfully", profile });
});

const updateNGOProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const { phone, orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId, merchantSecret, payHereAppId, payHereAppSecret, latitude, longitude } = req.body;

  const ngoUpdates: any = { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId };
  if (merchantSecret !== undefined) ngoUpdates.merchantSecret = encryptSecret(merchantSecret);
  if (payHereAppId) ngoUpdates.payHereAppId = String(payHereAppId).trim();
  if (payHereAppSecret) ngoUpdates.payHereAppSecret = encryptSecret(String(payHereAppSecret).trim());

  const profile = await NGOProfile.findOneAndUpdate(
    { userId },
    ngoUpdates,
    { new: true, runValidators: true, upsert: true }
  );

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const userUpdates: any = { profileImage: profile.profileImage || "" };
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  if (latitude !== undefined && longitude !== undefined) {
    const user = await User.findById(userId);
    await Rescuer.findOneAndUpdate(
      { userId },
      {
        userId,
        name: user.name || orgName || "NGO Rescuer",
        phone: user.phone || phone || "",
        avatar: profile.profileImage || "",
        isAvailable: true,
        location: { latitude: Number(latitude), longitude: Number(longitude) }
      },
      { upsert: true }
    );
  }

  res.status(200).json({ message: "Profile updated successfully", profile });
});

const updateVetProfile = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
  const { name, phone, primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId, merchantSecret, payHereAppId, payHereAppSecret, latitude, longitude } = req.body;

  const vetUpdates: any = { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId };
  if (merchantSecret !== undefined) vetUpdates.merchantSecret = encryptSecret(merchantSecret);
  if (payHereAppId) vetUpdates.payHereAppId = String(payHereAppId).trim();
  if (payHereAppSecret) vetUpdates.payHereAppSecret = encryptSecret(String(payHereAppSecret).trim());

  const profile = await VetProfile.findOneAndUpdate(
    { userId },
    vetUpdates,
    { new: true, runValidators: true, upsert: true }
  );

  if (!profile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const userUpdates: any = { profileImage: profile.profileImage || "" };
  if (name !== undefined) userUpdates.name = name;
  if (phone !== undefined) userUpdates.phone = phone;
  await User.findByIdAndUpdate(userId, userUpdates);

  if (latitude !== undefined && longitude !== undefined) {
    const user = await User.findById(userId);
    await Rescuer.findOneAndUpdate(
      { userId },
      {
        userId,
        name: user.name || name || clinicName || "Vet Rescuer",
        phone: user.phone || phone || "",
        avatar: profile.profileImage || "",
        isAvailable: true,
        location: { latitude: Number(latitude), longitude: Number(longitude) }
      },
      { upsert: true }
    );
  }

  res.status(200).json({ message: "Profile updated successfully", profile });
});

export {
  decryptSecret,
  createGeneralProfile,
  createVolunteerProfile,
  createNGOProfile,
  createVetProfile,
  getMyProfile,
  updateGeneralProfile,
  updateVolunteerProfile,
  updateNGOProfile,
  updateVetProfile,
};
