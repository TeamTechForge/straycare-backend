import mongoose from "mongoose";
import { mockRequest, mockResponse } from "../../helpers/mockRequestResponse";
import { NotificationService } from "../../../src/services/notificationService";

jest.mock("../../../src/utils/catchAsync", () => ({
  catchAsync: (fn: any) => fn,
}));

jest.mock("../../../src/models/Rescuer", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../../../src/models/User", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../../../src/models/RescueRequest", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../../../src/models/RescueHistory", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../src/models/StrayReport", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/Notification", () => ({
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
}));
jest.mock("../../../src/services/notificationService", () => ({
  NotificationService: { sendNotification: jest.fn() },
}));
jest.mock("../../../src/services/rescueService", () => ({
  RescueService: {
    findNearestRescuer: jest.fn(),
    createRescueRequest: jest.fn(),
  },
}));

const Rescuer = require("../../../src/models/Rescuer");
const User = require("../../../src/models/User");
const RescueRequest = require("../../../src/models/RescueRequest");
const RescueHistory = require("../../../src/models/RescueHistory");
const StrayReport = require("../../../src/models/StrayReport");
const Notification = require("../../../src/models/Notification");
const { RescueService } = require("../../../src/services/rescueService");
const {
  markRescueFailed,
  updateRescueDetails,
  respondToRescueRequest,
  cancelRescueRequest,
  acceptFromMap,
  getLiveTracking,
} = require("../../../src/controllers/rescueController");

describe("Rescue controller actions", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const rescuerId = new mongoose.Types.ObjectId().toString();
  const requestId = new mongoose.Types.ObjectId().toString();
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    req = mockRequest({
      user: { id: userId },
      app: {
        get: jest.fn().mockReturnValue({
          of: jest.fn().mockReturnValue({
            to: jest.fn().mockReturnValue({
              emit: jest.fn(),
            }),
          }),
        }),
      },
    } as any);
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
      "Case Updated • SC-456",
      "The rescue for your case has been completed. Updated by Sandevi.",
      "success",
      "RR-456",
      "SC-456",
      expect.objectContaining({ event: "rescue_completed", action: "view_case", animalType: "Cat", assignedRescuerName: "Sandevi", categoryId: "case_update", status: "Completed" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  describe("respondToRescueRequest (Accept / Reject / Validation flows)", () => {
    it("updates StrayReport status to Under Rescue and sets assignedRescuerId when rescuer accepts request", async () => {
      const rescuerProfileId = new mongoose.Types.ObjectId().toString();
      const otherReporterId = new mongoose.Types.ObjectId().toString();
      const request = {
        _id: requestId,
        rescueRequestId: "RR-789",
        rescuerId: rescuerProfileId,
        status: "pending",
        caseId: "SC-789",
        animalType: "Dog",
        userId: otherReporterId,
        rescuerName: "Kasun",
        save: jest.fn().mockResolvedValue(undefined),
      };
      const report = {
        caseId: "SC-789",
        anonymous: false,
        reporterUserId: otherReporterId,
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

    it("prevents a user from accepting a rescue request for a report they submitted themselves", async () => {
      const request = {
        _id: requestId,
        userId: userId, // Same as logged in user (reporter)
        status: "pending",
        caseId: "SC-SELF",
        save: jest.fn(),
      };

      (RescueRequest.findById as jest.Mock).mockResolvedValue(request);
      req.params = { id: requestId };
      req.body = { action: "accept" };

      await respondToRescueRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "You cannot accept or take a rescue request for a case you reported yourself.",
        })
      );
      expect(request.save).not.toHaveBeenCalled();
    });

    it("sets status to rejected when rescuer declines request and triggers circular fallback", async () => {
      const otherReporterId = new mongoose.Types.ObjectId().toString();
      const request = {
        _id: requestId,
        caseId: "SC-REJECT",
        userId: otherReporterId,
        rescuerId: rescuerId,
        status: "pending",
        rescueLocation: { latitude: 6.9271, longitude: 79.8612 },
        save: jest.fn().mockResolvedValue(undefined),
      };

      (RescueRequest.findById as jest.Mock).mockResolvedValue(request);
      (RescueRequest.find as jest.Mock).mockResolvedValue([{ rescuerId }]);
      (RescueService.findNearestRescuer as jest.Mock).mockResolvedValue(null);

      const report = {
        caseId: "SC-REJECT",
        status: "Pending Rescue",
        timeline: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      (StrayReport.findOne as jest.Mock).mockResolvedValue(report);

      req.params = { id: requestId };
      req.body = { action: "reject" };

      await respondToRescueRequest(req, res);

      expect(request.status).toBe("rejected");
      expect(request.save).toHaveBeenCalled();
      expect(report.status).toBe("Needs Help");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          request: expect.objectContaining({ status: "rejected" }),
        })
      );
    });
  });

  describe("cancelRescueRequest & Notification Removal", () => {
    it("cancels rescue request, deletes related notifications, and emits socket event", async () => {
      const request = {
        _id: requestId,
        caseId: "SC-CANCEL",
        status: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };

      (RescueRequest.findById as jest.Mock).mockReturnValue(mockQuery(request));
      req.params = { id: requestId };

      await cancelRescueRequest(req, res);

      expect(request.status).toBe("cancelled");
      expect(request.save).toHaveBeenCalled();
      expect(Notification.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { rescueRequestId: String(requestId) },
            { caseId: "SC-CANCEL" },
          ]),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          request: expect.objectContaining({ status: "cancelled" }),
        })
      );
    });
  });

  describe("acceptFromMap - Prevention of accepting own report", () => {
    it("rejects attempt by reporter to accept their own case from the map", async () => {
      (Rescuer.findOne as jest.Mock).mockResolvedValue({ _id: rescuerId, name: "Rescuer Name" });
      (StrayReport.findOne as jest.Mock).mockResolvedValue({
        caseId: "SC-MAP-SELF",
        reporterUserId: userId, // Same as logged in user
        status: "Needs Help",
      });

      req.body = { caseId: "SC-MAP-SELF" };

      await acceptFromMap(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "You cannot accept or take a rescue request for a case you reported yourself.",
        })
      );
    });
  });

  describe("getLiveTracking - Navigation & Real-Time Tracking Payload", () => {
    it("returns tracking details including reporter location, rescuer location, distance and ETA", async () => {
      const request = {
        _id: requestId,
        caseId: "SC-TRACK",
        status: "accepted",
        animalType: "Dog",
        rescueLocation: { latitude: 6.9271, longitude: 79.8612, address: "Colombo" },
        reporterLocation: { latitude: 6.9280, longitude: 79.8620 },
        distanceKm: 1.2,
        etaMinutes: 8,
        rescuerId: {
          _id: rescuerId,
          name: "Active Rescuer",
          location: { latitude: 6.9250, longitude: 79.8600 },
        },
      };

      (RescueRequest.findById as jest.Mock).mockReturnValue(mockQuery(request));
      (StrayReport.findOne as jest.Mock).mockResolvedValue(null);

      req.params = { requestId };

      await getLiveTracking(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: "SC-TRACK",
          distanceKm: expect.any(Number),
          etaMinutes: expect.any(Number),
          location: expect.objectContaining({ latitude: 6.9271, longitude: 79.8612 }),
        })
      );
    });
  });
});
