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

jest.mock("../../../src/models/StrayReport", () => ({
  findOne: jest.fn(),
}));

const Rescuer = require("../../../src/models/Rescuer");
const User = require("../../../src/models/User");
const { RescueService } = require("../../../src/services/rescueService");

describe("RescueService.findNearestRescuer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(result.rescuer.name).toBe("Verified NGO");
  });
});
