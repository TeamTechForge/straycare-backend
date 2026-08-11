"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileStatsService = void 0;
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const ForumPost = require("../models/ForumPost");
const StrayReport = require("../models/StrayReport");
const RescueHistory = require("../models/RescueHistory");
const RescueRequest = require("../models/RescueRequest");
const Rescuer = require("../models/Rescuer");
class ProfileStatsService {
    /**
     * Aggregates profile data and statistics dynamically using a Strategy Pattern based on the user's role.
     * Eliminates the need for bloated switch statements and ensures Open/Closed Principle adherence.
     *
     * @param userId - The MongoDB ObjectId of the user.
     * @param role - The string representation of the user's role (e.g., 'general_user', 'vet').
     * @returns A promise resolving to the user's profile data and their aggregated app statistics.
     */
    static async getProfileAndStats(userId, role) {
        const postCount = await ForumPost.countDocuments({ userId });
        let result = { profileData: {}, stats: {} };
        const strategy = this.strategies[role];
        if (strategy) {
            result = await strategy(userId);
        }
        result.stats.postsCount = postCount;
        return result;
    }
}
exports.ProfileStatsService = ProfileStatsService;
_a = ProfileStatsService;
ProfileStatsService.strategies = {
    general_user: async (userId) => {
        const generalProfile = await GeneralUserProfile.findOne({ userId }).lean() || {};
        const reportCount = await StrayReport.countDocuments({ reporterUserId: userId });
        return {
            profileData: {
                location: generalProfile.location || "",
                bio: generalProfile.bio || "",
                profileImage: generalProfile.profileImage || "",
            },
            stats: { reportsCount: reportCount }
        };
    },
    volunteer: async (userId) => {
        const volunteerProfile = await VolunteerProfile.findOne({ userId }).lean() || {};
        const rescuer = await Rescuer.findOne({ userId });
        const rescuerIdQuery = rescuer ? rescuer._id : userId;
        const reportCount = await StrayReport.countDocuments({ reporterUserId: userId });
        const totalRescues = await RescueHistory.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
        });
        const activeRescues = await RescueRequest.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }],
            status: { $in: ["accepted", "under_rescue", "Under Rescue"] }
        });
        const totalAttempts = await RescueRequest.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
        });
        const completionRate = totalAttempts > 0 ? Math.round((totalRescues / totalAttempts) * 100) : 100;
        return {
            profileData: {
                location: volunteerProfile.location || "",
                bio: volunteerProfile.bio || "",
                profileImage: volunteerProfile.profileImage || "",
                serviceArea: volunteerProfile.serviceArea || "",
                rescueCompletionRate: completionRate,
            },
            stats: {
                reportsCount: reportCount,
                rescuesCompleted: totalRescues + activeRescues,
                activeRescues: activeRescues
            }
        };
    },
    vet: async (userId) => {
        const vetProfile = await VetProfile.findOne({ userId }).lean() || {};
        const rescuer = await Rescuer.findOne({ userId });
        const rescuerIdQuery = rescuer ? rescuer._id : userId;
        const reportCount = await StrayReport.countDocuments({ reporterUserId: userId });
        const totalRescues = await RescueHistory.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
        });
        const activeRescues = await RescueRequest.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }],
            status: { $in: ["accepted", "under_rescue", "Under Rescue"] }
        });
        return {
            profileData: {
                location: vetProfile.primaryLocation || "",
                bio: vetProfile.bio || "",
                profileImage: vetProfile.profileImage || "",
                clinicName: vetProfile.clinicName || "",
                clinicAddress: vetProfile.clinicAddress || "",
                specialization: vetProfile.specialization || "",
                animalsTreated: vetProfile.animalsTreated || 0,
                emergencyAvailability: vetProfile.emergencyAvailability || false,
            },
            stats: {
                reportsCount: reportCount,
                rescuesCompleted: totalRescues + activeRescues,
                animalsTreated: vetProfile.animalsTreated || 0
            }
        };
    },
    ngo: async (userId) => {
        const ngoProfile = await NGOProfile.findOne({ userId }).lean() || {};
        const rescuer = await Rescuer.findOne({ userId });
        const rescuerIdQuery = rescuer ? rescuer._id : userId;
        const reportCount = await StrayReport.countDocuments({ reporterUserId: userId });
        const totalRescues = await RescueHistory.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
        });
        const activeRescues = await RescueRequest.countDocuments({
            $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }],
            status: { $in: ["accepted", "under_rescue", "Under Rescue"] }
        });
        return {
            profileData: {
                location: ngoProfile.location || "",
                bio: ngoProfile.bio || "",
                profileImage: ngoProfile.profileImage || "",
                orgName: ngoProfile.orgName || "",
                totalAdoptions: ngoProfile.totalAdoptions || 0,
                donationCampaignCount: ngoProfile.donationCampaignCount || 0,
            },
            stats: {
                reportsCount: reportCount,
                rescuesCompleted: totalRescues + activeRescues,
                totalAdoptions: ngoProfile.totalAdoptions || 0,
                donationCampaignCount: ngoProfile.donationCampaignCount || 0
            }
        };
    }
};
//# sourceMappingURL=profileStatsService.js.map