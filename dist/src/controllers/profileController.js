"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const User = require("../models/User");
const createGeneralProfile = async (req, res) => {
    try {
        const { location, bio, profileImage, name } = req.body;
        const userId = req.user.id;
        const profile = await GeneralUserProfile.findOneAndUpdate({ userId }, { location, bio, profileImage }, { new: true, upsert: true, runValidators: true });
        await User.findByIdAndUpdate(userId, { name, profileCompleted: true, profileImage: profile.profileImage || "" });
        res.status(201).json({ message: "General profile created", profile });
    }
    catch (error) {
        console.error("Error in createGeneralProfile:", error);
        res.status(500).json({ message: "Failed to create general profile", error: error.message });
    }
};
const createVolunteerProfile = async (req, res) => {
    try {
        const { location, bio, profileImage, name } = req.body;
        const userId = req.user.id;
        const profile = await VolunteerProfile.findOneAndUpdate({ userId }, { location, bio, profileImage }, { new: true, upsert: true, runValidators: true });
        await User.findByIdAndUpdate(userId, { name, profileCompleted: true, profileImage: profile.profileImage || "" });
        const user = await User.findById(userId);
        const Rescuer = require("../models/Rescuer");
        await Rescuer.findOneAndUpdate({ userId }, {
            userId,
            name: user.name,
            phone: user.phone || "",
            avatar: profile.profileImage || "",
            isAvailable: true,
            location: {
                latitude: Number(req.body.latitude) || 6.9271,
                longitude: Number(req.body.longitude) || 79.8612,
            },
        }, { upsert: true, new: true });
        res.status(201).json({ message: "Volunteer profile created", profile });
    }
    catch (error) {
        console.error("Error in createVolunteerProfile:", error);
        res.status(500).json({ message: "Failed to create volunteer profile", error: error.message });
    }
};
const createNGOProfile = async (req, res) => {
    try {
        const { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId, merchantSecret } = req.body;
        const userId = req.user.id;
        const profile = await NGOProfile.findOneAndUpdate({ userId }, {
            orgName,
            contactPerson,
            regNumber,
            foundedYear,
            location,
            bio,
            profileImage,
            verificationDocument,
            merchantId,
            merchantSecret,
        }, { new: true, upsert: true, runValidators: true });
        await User.findByIdAndUpdate(userId, { profileCompleted: true, profileImage: profile.profileImage || "" });
        const user = await User.findById(userId);
        const Rescuer = require("../models/Rescuer");
        await Rescuer.findOneAndUpdate({ userId }, {
            userId,
            name: user.name || orgName || "NGO Rescuer",
            phone: user.phone || "",
            avatar: profile.profileImage || "",
            isAvailable: true,
            location: {
                latitude: Number(req.body.latitude) || 6.9271,
                longitude: Number(req.body.longitude) || 79.8612,
            },
        }, { upsert: true, new: true });
        res.status(201).json({ message: "NGO profile created", profile });
    }
    catch (error) {
        console.error("Error in createNGOProfile:", error);
        res.status(500).json({ message: "Failed to create NGO profile", error: error.message });
    }
};
const createVetProfile = async (req, res) => {
    try {
        const { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId, merchantSecret } = req.body;
        const userId = req.user.id;
        const profile = await VetProfile.findOneAndUpdate({ userId }, {
            primaryLocation,
            bio,
            clinicName,
            clinicAddress,
            licenseNumber,
            yearsOfExperience,
            profileImage,
            licenseDocument,
            merchantId,
            merchantSecret,
        }, { new: true, upsert: true, runValidators: true });
        await User.findByIdAndUpdate(userId, { profileCompleted: true, profileImage: profile.profileImage || "" });
        const user = await User.findById(userId);
        const Rescuer = require("../models/Rescuer");
        await Rescuer.findOneAndUpdate({ userId }, {
            userId,
            name: user.name || clinicName || "Vet Rescuer",
            phone: user.phone || "",
            avatar: profile.profileImage || "",
            isAvailable: true,
            location: {
                latitude: Number(req.body.latitude) || 6.9271,
                longitude: Number(req.body.longitude) || 79.8612,
            },
        }, { upsert: true, new: true });
        res.status(201).json({ message: "Vet profile created", profile });
    }
    catch (error) {
        console.error("Error in createVetProfile:", error);
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
        }
        else if (role === "volunteer") {
            profile = await VolunteerProfile.findOne({ userId });
        }
        else if (role === "ngo") {
            profile = await NGOProfile.findOne({ userId });
        }
        else if (role === "vet") {
            profile = await VetProfile.findOne({ userId });
        }
        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }
        res.status(200).json(profile);
    }
    catch (error) {
        console.error("Error in getMyProfile:", error);
        res.status(500).json({ message: "Failed to fetch profile", error: error.message });
    }
};
const updateGeneralProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location, bio, profileImage } = req.body;
        const profile = await GeneralUserProfile.findOneAndUpdate({ userId }, { location, bio, profileImage }, { new: true, runValidators: true });
        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }
        await User.findByIdAndUpdate(userId, { profileImage: profile.profileImage || "" });
        res.status(200).json({ message: "Profile updated successfully", profile });
    }
    catch (error) {
        console.error("Error in updateGeneralProfile:", error);
        res.status(500).json({ message: "Failed to update profile", error: error.message });
    }
};
const updateVolunteerProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location, bio, profileImage } = req.body;
        const profile = await VolunteerProfile.findOneAndUpdate({ userId }, { location, bio, profileImage }, { new: true, runValidators: true });
        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }
        await User.findByIdAndUpdate(userId, { profileImage: profile.profileImage || "" });
        res.status(200).json({ message: "Profile updated successfully", profile });
    }
    catch (error) {
        console.error("Error in updateVolunteerProfile:", error);
        res.status(500).json({ message: "Failed to update profile", error: error.message });
    }
};
const updateNGOProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId, merchantSecret } = req.body;
        const profile = await NGOProfile.findOneAndUpdate({ userId }, { orgName, contactPerson, regNumber, foundedYear, location, bio, profileImage, verificationDocument, merchantId, merchantSecret }, { new: true, runValidators: true });
        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }
        await User.findByIdAndUpdate(userId, { profileImage: profile.profileImage || "" });
        res.status(200).json({ message: "Profile updated successfully", profile });
    }
    catch (error) {
        console.error("Error in updateNGOProfile:", error);
        res.status(500).json({ message: "Failed to update profile", error: error.message });
    }
};
const updateVetProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId, merchantSecret } = req.body;
        const profile = await VetProfile.findOneAndUpdate({ userId }, { primaryLocation, bio, clinicName, clinicAddress, licenseNumber, yearsOfExperience, profileImage, licenseDocument, merchantId, merchantSecret }, { new: true, runValidators: true });
        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }
        await User.findByIdAndUpdate(userId, { profileImage: profile.profileImage || "" });
        res.status(200).json({ message: "Profile updated successfully", profile });
    }
    catch (error) {
        console.error("Error in updateVetProfile:", error);
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
//# sourceMappingURL=profileController.js.map