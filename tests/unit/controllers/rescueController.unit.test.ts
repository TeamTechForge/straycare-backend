import mongoose from "mongoose";
import { mockRequest, mockResponse } from "../../helpers/mockRequestResponse";
import { NotificationService } from "../../../src/services/notificationService";

jest.mock("../../../src/utils/catchAsync", () => ({
  catchAsync: (fn: any) => fn,
}));

jest.mock("../../../src/models/Rescuer", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../../../src/models/RescueRequest", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/RescueHistory", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../src/models/StrayReport", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/services/notificationService", () => ({
  NotificationService: { sendNotification: jest.fn() },
}));

const Rescuer = require("../../../src/models/Rescuer");
const RescueRequest = require("../../../src/models/RescueRequest");
const RescueHistory = require("../../../src/models/RescueHistory");
const StrayReport = require("../../../src/models/StrayReport");
const { markRescueFailed, updateRescueDetails, respondToRescueRequest } = require("../../../src/controllers/rescueController");

describe("Rescue controller actions", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const rescuerId = new mongoose.Types.ObjectId().toString();
  const requestId = new mongoose.Types.ObjectId().toString();
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest({ user: { id: userId } } as any);
    res = mockResponse();
  });

  const mockQuery = (doc: any) => ({
    populate: jest.fn().mockImplementation(() => Promise.resolve(doc)),
    sort: jest.fn().mockImplementation(() => Promise.resolve(doc)),
    then: (resolve: any, reject: any) => Promise.resolve(doc).then(resolve, reject),
  });

  it("records a failed rescue, appends its timeline event, and notifies the reporter", async () => {
    const request = {
      _id: requestId,
      rescueRequestId: "RR-123",
      // Find-rescuer requests created by older clients store the account ID
      // instead of the Rescuer profile ID.
      rescuerId: userId,
      status: "accepted",
      caseId: "SC-123",
      animalType: "Dog",
      userId,
      rescuerName: "Sandevi",
      save: jest.fn(),
    };
    const report = {
      anonymous: false,
      reporterUserId: userId,
      animalType: "Dog",
      timeline: [],
      save: jest.fn(),
    };

    (RescueRequest.findById as jest.Mock).mockReturnValue(mockQuery(request));
    (Rescuer.findOne as jest.Mock).mockResolvedValue({ _id: rescuerId, name: "Sandevi" });
    (RescueHistory.findOneAndUpdate as jest.Mock).mockResolvedValue({ rescueRequestId: "RR-123", status: "failed" });
    (StrayReport.findOne as jest.Mock).mockResolvedValue(report);
    req.params = { id: requestId };

    await markRescueFailed(req, res);

    expect(RescueHistory.findOneAndUpdate).toHaveBeenCalledWith(
      { rescueRequestId: "RR-123" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "failed", outcome: "failed" }) }),
      expect.objectContaining({ upsert: true })
    );
    expect(request.status).toBe("failed");
    expect(report.timeline).toEqual([expect.objectContaining({ status: "Rescue Failed" })]);
    expect(report.save).toHaveBeenCalled();
    expect(NotificationService.sendNotification).toHaveBeenCalledWith(
      userId,
      "Rescue Failed • SC-123",
      "The rescue for case SC-123 could not be completed.",
      "error",
      "RR-123",
      "SC-123",
      expect.objectContaining({ event: "rescue_failed" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("notifies the reporter when the rescuer completes the rescue", async () => {
    const request = {
      _id: requestId,
      rescueRequestId: "RR-456",
      rescuerId: userId,
      status: "accepted",
      caseId: "SC-456",
      animalType: "Cat",
      rescuerName: "Sandevi",
      save: jest.fn(),
    };
    const report = {
      anonymous: false,
      reporterUserId: userId,
      animalType: "Cat",
      timeline: [],
      save: jest.fn(),
    };

    (RescueRequest.findById as jest.Mock).mockReturnValue(mockQuery(request));
    (RescueHistory.findById as jest.Mock).mockResolvedValue(null);
    (RescueHistory.findOne as jest.Mock).mockResolvedValue(null);
    (Rescuer.findOne as jest.Mock).mockResolvedValue({ _id: rescuerId });
    (StrayReport.findOne as jest.Mock)
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: "Under Rescue" }) }) })
      .mockResolvedValueOnce(report);
    req.params = { id: requestId };
    req.body = { status: "Completed" };

    await updateRescueDetails(req, res);

    expect(request.status).toBe("completed");
    expect(report.timeline).toEqual([expect.objectContaining({ status: "Completed" })]);
    expect(NotificationService.sendNotification).toHaveBeenCalledWith(
      userId,
      "Rescue Completed • SC-456",
      "The rescue for case SC-456 has been completed by Sandevi.",
      "success",
      "RR-456",
      "SC-456",
      expect.objectContaining({ event: "rescue_completed" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("updates StrayReport status to Under Rescue and sets assignedRescuerId when rescuer accepts request", async () => {
    const rescuerProfileId = new mongoose.Types.ObjectId().toString();
    const request = {
      _id: requestId,
      rescueRequestId: "RR-789",
      rescuerId: rescuerProfileId,
      status: "pending",
      caseId: "SC-789",
      animalType: "Dog",
      userId: new mongoose.Types.ObjectId().toString(),
      rescuerName: "Kasun",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const report = {
      caseId: "SC-789",
      anonymous: false,
      reporterUserId: request.userId,
      animalType: "Dog",
      status: "Needs Help",
      assignedRescuerId: undefined,
      timeline: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    (RescueRequest.findById as jest.Mock).mockResolvedValue(request);
    (StrayReport.findOne as jest.Mock).mockResolvedValue(report);
    (Rescuer.findById as jest.Mock).mockResolvedValue({ _id: rescuerProfileId, name: "Kasun" });
    req.params = { id: requestId };
    req.body = { action: "accept" };

    await respondToRescueRequest(req, res);

    expect(request.status).toBe("accepted");
    expect(request.save).toHaveBeenCalled();
    expect(report.status).toBe("Under Rescue");
    expect(report.assignedRescuerId).toBe(rescuerProfileId);
    expect(report.timeline).toEqual([
      expect.objectContaining({
        status: "Under Rescue",
        message: "Case accepted by rescuer: Kasun",
      }),
    ]);
    expect(report.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        request: expect.objectContaining({ status: "accepted" }),
      })
    );
  });
});
