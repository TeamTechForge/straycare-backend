import mongoose from "mongoose";

jest.mock("../../../src/models/Rescuer", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../../../src/models/User", () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../../../src/models/VolunteerProfile", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../../src/models/NGOProfile", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../../src/models/VetProfile", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../../src/models/StrayReport", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../../src/models/RescueRequest", () => ({
  create: jest.fn(),
}));

jest.mock("../../../src/services/notificationService", () => ({
  NotificationService: {
    sendNotification: jest.fn().mockResolvedValue(true),
  },
}));

const Rescuer = require("../../../src/models/Rescuer");
const User = require("../../../src/models/User");
const VolunteerProfile = require("../../../src/models/VolunteerProfile");
const NGOProfile = require("../../../src/models/NGOProfile");
const VetProfile = require("../../../src/models/VetProfile");
const StrayReport = require("../../../src/models/StrayReport");
const RescueRequest = require("../../../src/models/RescueRequest");
const { NotificationService } = require("../../../src/services/notificationService");
const { RescueService } = require("../../../src/services/rescueService");

describe("RescueService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockProfileChain = () => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    (VolunteerProfile.findOne as jest.Mock).mockImplementation(mockProfileChain);
    (NGOProfile.findOne as jest.Mock).mockImplementation(mockProfileChain);
    (VetProfile.findOne as jest.Mock).mockImplementation(mockProfileChain);
    (User.findById as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          name: "Test Rescuer",
          profileImage: "avatar.jpg",
          role: "volunteer",
        }),
      }),
    }));
  });

  describe("findNearestRescuer - Proximity & Eligibility (within 5 km)", () => {
    it("filters out unapproved NGO and Vet accounts and suspended accounts", async () => {
      const unverifiedVetId = new mongoose.Types.ObjectId();
      const verifiedNgoId = new mongoose.Types.ObjectId();
      const suspendedVolunteerId = new mongoose.Types.ObjectId();

      const mockRescuers = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: unverifiedVetId,
          name: "Dr. Unverified",
          location: { latitude: 6.9271, longitude: 79.8612 },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: verifiedNgoId,
          name: "Verified NGO",
          location: { latitude: 6.9280, longitude: 79.8620 },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: suspendedVolunteerId,
          name: "Suspended Volunteer",
          location: { latitude: 6.9272, longitude: 79.8613 },
        },
      ];

      (Rescuer.find as jest.Mock).mockResolvedValue(mockRescuers);

      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: unverifiedVetId, role: "vet", isApproved: false, accountStatus: null },
            { _id: verifiedNgoId, role: "ngo", isApproved: true, accountStatus: null },
            { _id: suspendedVolunteerId, role: "volunteer", isApproved: false, accountStatus: "Suspended" },
          ]),
        }),
      });

      const result = await RescueService.findNearestRescuer({
        latitude: 6.9270,
        longitude: 79.8610,
        maxDistanceKm: 10,
      });

      expect(result).not.toBeNull();
      expect(result?.rescuer.name).toBe("Verified NGO");
    });

    it("discovers nearest rescuer within 5 km and ignores rescuers farther than 5 km", async () => {
      const nearRescuerUserId = new mongoose.Types.ObjectId();
      const farRescuerUserId = new mongoose.Types.ObjectId();

      const mockRescuers = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: nearRescuerUserId,
          name: "Near Rescuer (2 km)",
          location: { latitude: 6.9350, longitude: 79.8650 },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: farRescuerUserId,
          name: "Far Rescuer (12 km)",
          location: { latitude: 7.0500, longitude: 79.9500 },
        },
      ];

      (Rescuer.find as jest.Mock).mockResolvedValue(mockRescuers);
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: nearRescuerUserId, role: "volunteer", isApproved: true, accountStatus: "Active" },
            { _id: farRescuerUserId, role: "volunteer", isApproved: true, accountStatus: "Active" },
          ]),
        }),
      });

      const result = await RescueService.findNearestRescuer({
        latitude: 6.9270,
        longitude: 79.8610,
        maxDistanceKm: 5,
      });

      expect(result).not.toBeNull();
      expect(result?.rescuer.name).toBe("Near Rescuer (2 km)");
      expect(parseFloat(result!.distance)).toBeLessThanOrEqual(5);
    });

    it("prevents reporter from being discovered as the rescuer for their own report", async () => {
      const reporterUserId = new mongoose.Types.ObjectId();
      const otherRescuerUserId = new mongoose.Types.ObjectId();

      const mockRescuers = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: reporterUserId,
          name: "Self Rescuer (Reporter)",
          location: { latitude: 6.9271, longitude: 79.8612 },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: otherRescuerUserId,
          name: "Other Rescuer",
          location: { latitude: 6.9300, longitude: 79.8630 },
        },
      ];

      (Rescuer.find as jest.Mock).mockResolvedValue(mockRescuers);
      (User.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: reporterUserId, role: "volunteer", isApproved: true, accountStatus: "Active" },
            { _id: otherRescuerUserId, role: "volunteer", isApproved: true, accountStatus: "Active" },
          ]),
        }),
      });

      const result = await RescueService.findNearestRescuer({
        latitude: 6.9270,
        longitude: 79.8610,
        maxDistanceKm: 5,
        reporterUserId: reporterUserId.toString(),
      });

      expect(result).not.toBeNull();
      expect(result?.rescuer.name).toBe("Other Rescuer");
    });
  });

  describe("createRescueRequest - Direct Request and Dispatch", () => {
    it("creates a pending rescue request and dispatches a notification to the rescuer", async () => {
      const rescuerUserId = new mongoose.Types.ObjectId().toString();
      const mockRescuer = {
        _id: new mongoose.Types.ObjectId().toString(),
        userId: rescuerUserId,
        name: "Kasun Rescuer",
        phone: "0771234567",
        location: { latitude: 6.9271, longitude: 79.8612 },
      };

      const payload = {
        userId: "reporter-user-123",
        caseId: "CASE-2026-001",
        animalType: "Dog",
        description: "Injured stray dog near temple",
        photos: ["https://example.com/dog.jpg"],
        reporterName: "John Reporter",
        reporterPhone: "0779999999",
        distanceKm: 2.5,
        etaMinutes: 15,
      };

      const createdRequest = {
        _id: "req-12345",
        ...payload,
        status: "pending",
        rescuerId: mockRescuer._id,
        rescuerName: mockRescuer.name,
      };

      (RescueRequest.create as jest.Mock).mockResolvedValue(createdRequest);
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({
          name: "Kasun Rescuer",
          phone: "0771234567",
          profileImage: "avatar.jpg",
        }),
      });

      const result = await RescueService.createRescueRequest(payload, mockRescuer);

      expect(RescueRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "reporter-user-123",
          caseId: "CASE-2026-001",
          status: "pending",
          animalType: "Dog",
          photos: ["https://example.com/dog.jpg"],
        })
      );
      expect(NotificationService.sendNotification).toHaveBeenCalledWith(
        rescuerUserId,
        "New Rescue Request",
        expect.stringContaining("Dog"),
        "info",
        "req-12345",
        "CASE-2026-001"
      );
      expect(result.status).toBe("pending");
    });
  });
});
