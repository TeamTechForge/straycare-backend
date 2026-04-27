const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const User = require("../models/User");

const createGeneralProfile = async (req, res) => {
  try {
    const { location, bio, profileImage } = req.body;
    const userId = req.user.id;

    const profile = await GeneralUserProfile.create({
      userId,
      location,
      bio,
      profileImage, // Expecting URL from frontend or middleware
    });

    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    res.status(201).json({ message: "General profile created", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to create general profile", error: error.message });
  }
};

const createVolunteerProfile = async (req, res) => {
  try {
    const { location, bio, profileImage } = req.body;
    const userId = req.user.id;

    const profile = await VolunteerProfile.create({
      userId,
      location,
      bio,
      profileImage,
    });

    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    res.status(201).json({ message: "Volunteer profile created", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to create volunteer profile", error: error.message });
  }
};

const createNGOProfile = async (req, res) => {
  try {
    const { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId } = req.body;
    const userId = req.user.id;

    const profile = await NGOProfile.create({
      userId,
      orgName,
      contactPerson,
      regNumber,
      foundedYear,
      location,
      bio,
      profileImage,
      verificationDocument,
      merchantId,
    });

    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    res.status(201).json({ message: "NGO profile created", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to create NGO profile", error: error.message });
  }
};

const createVetProfile = async (req, res) => {
  try {
    const { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId } = req.body;
    const userId = req.user.id;

    const profile = await VetProfile.create({
      userId,
      primaryLocation,
      bio,
      clinicName,
      clinicAddress,
      licenseNumber,
      yearsOfExperience,
      profileImage,
      licenseDocument,
      merchantId,
    });

    await User.findByIdAndUpdate(userId, { profileCompleted: true });

    res.status(201).json({ message: "Vet profile created", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to create vet profile", error: error.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let profile = null;

    if (role === "general_user") {
      profile = await GeneralUserProfile.findOne({ userId });
    } else if (role === "volunteer") {
      profile = await VolunteerProfile.findOne({ userId });
    } else if (role === "ngo") {
      profile = await NGOProfile.findOne({ userId });
    } else if (role === "vet") {
      profile = await VetProfile.findOne({ userId });
    }

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
};

const updateGeneralProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, bio, profileImage } = req.body;

    const profile = await GeneralUserProfile.findOneAndUpdate(
      { userId },
      { location, bio, profileImage },
      { new: true, runValidators: true }
    );

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.status(200).json({ message: "Profile updated successfully", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

const updateVolunteerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, bio, profileImage } = req.body;

    const profile = await VolunteerProfile.findOneAndUpdate(
      { userId },
      { location, bio, profileImage },
      { new: true, runValidators: true }
    );

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.status(200).json({ message: "Profile updated successfully", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

const updateNGOProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId } = req.body;

    const profile = await NGOProfile.findOneAndUpdate(
      { userId },
      { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId },
      { new: true, runValidators: true }
    );

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.status(200).json({ message: "Profile updated successfully", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

const updateVetProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId } = req.body;

    const profile = await VetProfile.findOneAndUpdate(
      { userId },
      { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId },
      { new: true, runValidators: true }
    );

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.status(200).json({ message: "Profile updated successfully", profile });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

module.exports = {
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
