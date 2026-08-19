import mongoose from "mongoose";

jest.mock("../../../src/models/GeneralUserProfile", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/VolunteerProfile", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/VetProfile", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/NGOProfile", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/ForumPost", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../../src/models/CommunityPost", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../../src/models/StrayReport", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../../src/models/RescueHistory", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../../src/models/RescueRequest", () => ({
  countDocuments: jest.fn(),
}));
jest.mock("../../../src/models/Rescuer", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/Donation", () => ({
  find: jest.fn(),
}));

const GeneralUserProfile = require("../../../src/models/GeneralUserProfile");
const VolunteerProfile = require("../../../src/models/VolunteerProfile");
const ForumPost = require("../../../src/models/ForumPost");
const CommunityPost = require("../../../src/models/CommunityPost").default || require("../../../src/models/CommunityPost");
const StrayReport = require("../../../src/models/StrayReport");
const RescueHistory = require("../../../src/models/RescueHistory");
const RescueRequest = require("../../../src/models/RescueRequest");
const Rescuer = require("../../../src/models/Rescuer");
const { ProfileStatsService } = require("../../../src/services/profileStatsService");

describe("ProfileStatsService", () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (ForumPost.countDocuments as jest.Mock).mockResolvedValue(2);
    (CommunityPost.countDocuments as jest.Mock).mockResolvedValue(3);
  });

  const mockLean = (data: any) => ({
    lean: jest.fn().mockResolvedValue(data),
  });

  describe("getProfileAndStats - General User Case Summaries & Privacy", () => {
    it("returns case summary stats and postsCount for a general user", async () => {
      (GeneralUserProfile.findOne as jest.Mock).mockReturnValue(
        mockLean({ location: "Colombo", bio: "Animal enthusiast", profileImage: "img.png" })
      );
      (StrayReport.countDocuments as jest.Mock).mockResolvedValue(5);

      const result = await ProfileStatsService.getProfileAndStats(userId, "general_user", true);

      expect(result.profileData).toEqual({
        location: "Colombo",
        bio: "Animal enthusiast",
        profileImage: "img.png",
      });
      expect(result.stats).toEqual({
        reportsCount: 5,
        postsCount: 5, // 2 forum + 3 community
      });
    });

    it("filters out anonymous reports when a third party views profile (isSelf = false)", async () => {
      (GeneralUserProfile.findOne as jest.Mock).mockReturnValue(mockLean({}));
      (StrayReport.countDocuments as jest.Mock).mockResolvedValue(2);

      await ProfileStatsService.getProfileAndStats(userId, "general_user", false);

      expect(StrayReport.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymous: false,
          $or: [{ reporterUserId: userId }, { userId: userId }],
        })
      );
    });

    it("includes anonymous reports when user views their own profile (isSelf = true)", async () => {
      (GeneralUserProfile.findOne as jest.Mock).mockReturnValue(mockLean({}));
      (StrayReport.countDocuments as jest.Mock).mockResolvedValue(4);

      await ProfileStatsService.getProfileAndStats(userId, "general_user", true);

      const queryArg = (StrayReport.countDocuments as jest.Mock).mock.calls[0][0];
      expect(queryArg.anonymous).toBeUndefined();
    });
  });

  describe("getProfileAndStats - Volunteer User Rescues & Summaries", () => {
    it("calculates active rescues and completed rescues for volunteer", async () => {
      (VolunteerProfile.findOne as jest.Mock).mockReturnValue(
        mockLean({ location: "Kandy", bio: "Active rescuer", serviceArea: "Central" })
      );
      (Rescuer.findOne as jest.Mock).mockResolvedValue({ _id: "rescuer-vol-1" });
      (StrayReport.countDocuments as jest.Mock).mockResolvedValue(3);
      (RescueHistory.countDocuments as jest.Mock).mockResolvedValue(10);
      (RescueRequest.countDocuments as jest.Mock)
        .mockResolvedValueOnce(2) // activeRescues
        .mockResolvedValueOnce(12); // totalAttempts

      const result = await ProfileStatsService.getProfileAndStats(userId, "volunteer", true);

      expect(result.stats).toEqual({
        reportsCount: 3,
        rescuesCompleted: 12, // 10 completed + 2 active
        activeRescues: 2,
        postsCount: 5,
      });
      expect(result.profileData.rescueCompletionRate).toBe(83); // Math.round(10/12 * 100)
    });
  });
});
