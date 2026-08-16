const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const ForumPost = require("../models/ForumPost");
const StrayReport = require("../models/StrayReport");
const RescueHistory = require("../models/RescueHistory");
const RescueRequest = require("../models/RescueRequest");
const Rescuer = require("../models/Rescuer");
const Donation = require("../models/Donation");

interface ProfileResult {
  profileData: any;
  stats: any;
}

type ProfileStrategy = (userId: string, isSelf?: boolean) => Promise<ProfileResult>;

export class ProfileStatsService {
  private static readonly strategies: Record<string, ProfileStrategy> = {
    general_user: async (userId: string, isSelf = false) => {
      const generalProfile: any = await GeneralUserProfile.findOne({ userId }).lean() || {};
      const reportQuery: any = {
        $or: [{ reporterUserId: userId }, { userId: userId }]
      };
      if (!isSelf) {
        reportQuery.anonymous = false;
      }
      const reportCount = await StrayReport.countDocuments(reportQuery);
      return {
        profileData: {
          location: generalProfile.location || "",
          bio: generalProfile.bio || "",
          profileImage: generalProfile.profileImage || "",
        },
        stats: { reportsCount: reportCount }
      };
    },
    volunteer: async (userId: string, isSelf = false) => {
      const volunteerProfile: any = await VolunteerProfile.findOne({ userId }).lean() || {};
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const reportQuery: any = {
        $or: [{ reporterUserId: userId }, { userId: userId }]
      };
      if (!isSelf) {
        reportQuery.anonymous = false;
      }
      const reportCount = await StrayReport.countDocuments(reportQuery);
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
    vet: async (userId: string, isSelf = false) => {
      const vetProfile: any = await VetProfile.findOne({ userId }).lean() || {};
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const reportQuery: any = {
        $or: [{ reporterUserId: userId }, { userId: userId }]
      };
      if (!isSelf) {
        reportQuery.anonymous = false;
      }
      const reportCount = await StrayReport.countDocuments(reportQuery);
      const totalRescues = await RescueHistory.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
      });
      const activeRescues = await RescueRequest.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }], 
        status: { $in: ["accepted", "under_rescue", "Under Rescue"] } 
      });

      const organizationIds = [userId];
      if (vetProfile._id) organizationIds.push(vetProfile._id.toString());
      const donations = await Donation.find({
        organizationId: { $in: organizationIds },
        status: "SUCCESS"
      }).lean();
      const totalDonations = donations.reduce((sum: number, doc: any) => sum + (doc.amount || 0), 0);

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
          animalsTreated: vetProfile.animalsTreated || 0,
          totalDonations: totalDonations
        }
      };
    },
    ngo: async (userId: string, isSelf = false) => {
      const ngoProfile: any = await NGOProfile.findOne({ userId }).lean() || {};
      const rescuer = await Rescuer.findOne({ userId });
      const rescuerIdQuery = rescuer ? rescuer._id : userId;

      const reportQuery: any = {
        $or: [{ reporterUserId: userId }, { userId: userId }]
      };
      if (!isSelf) {
        reportQuery.anonymous = false;
      }
      const reportCount = await StrayReport.countDocuments(reportQuery);
      const totalRescues = await RescueHistory.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }]
      });
      const activeRescues = await RescueRequest.countDocuments({ 
        $or: [{ rescuerId: userId }, { rescuerId: String(rescuerIdQuery) }], 
        status: { $in: ["accepted", "under_rescue", "Under Rescue"] } 
      });

      const organizationIds = [userId];
      if (ngoProfile._id) organizationIds.push(ngoProfile._id.toString());
      const donations = await Donation.find({
        organizationId: { $in: organizationIds },
        status: "SUCCESS"
      }).lean();
      const totalDonations = donations.reduce((sum: number, doc: any) => sum + (doc.amount || 0), 0);

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
          donationCampaignCount: ngoProfile.donationCampaignCount || 0,
          totalDonations: totalDonations
        }
      };
    }
  };

  /**
   * Aggregates profile data and statistics dynamically using a Strategy Pattern based on the user's role.
   * Eliminates the need for bloated switch statements and ensures Open/Closed Principle adherence.
   * 
   * @param userId - The MongoDB ObjectId of the user.
   * @param role - The string representation of the user's role (e.g., 'general_user', 'vet').
   * @param isSelf - Whether the requesting user is viewing their own profile.
   * @returns A promise resolving to the user's profile data and their aggregated app statistics.
   */
  public static async getProfileAndStats(userId: string, role: string, isSelf = false): Promise<ProfileResult> {
    const postCount = await ForumPost.countDocuments({ userId });
    
    let result: ProfileResult = { profileData: {}, stats: {} };
    
    const strategy = this.strategies[role];
    if (strategy) {
      result = await strategy(userId, isSelf);
    }
    
    result.stats.postsCount = postCount;
    return result;
  }
}
