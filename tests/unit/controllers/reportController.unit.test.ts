import { mockNext, mockRequest, mockResponse } from "../../helpers/mockRequestResponse";

jest.mock("../../../src/utils/catchAsync", () => ({
  catchAsync: (fn: any) => fn,
}));

jest.mock("../../../src/models/StrayReport");
jest.mock("../../../src/models/User");
jest.mock("../../../src/models/Rescuer");
jest.mock("../../../src/models/RescueRequest");
jest.mock("../../../src/services/notificationService", () => ({
  NotificationService: { sendNotification: jest.fn().mockResolvedValue(true) },
}));

const { createReport, acceptReportFromMap, updateCaseStatus } = require("../../../src/controllers/reportController");
const StrayReport = require("../../../src/models/StrayReport");
const User = require("../../../src/models/User");
const Rescuer = require("../../../src/models/Rescuer");
const RescueRequest = require("../../../src/models/RescueRequest");
const { NotificationService } = require("../../../src/services/notificationService");

const selectResult = (value: any) => ({ select: jest.fn().mockResolvedValue(value) });

describe("Report controller reporting workflow", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  describe("createReport", () => {
    it("creates a reporter-owned case with normalized report data", async () => {
      req.user = { id: "reporter-1" };
      req.body = {
        animalType: " dog ",
        categories: '["Injured", "Abandoned"]',
        notes: " Needs urgent help ",
        location: JSON.stringify({ lat: 6.9271, lng: 79.8612, address: " Colombo " }),
        photos: '["photo-1"]',
        preventAutoMatch: true,
      };
      User.findById.mockReturnValue(selectResult({ name: "Asha" }));
      StrayReport.create.mockResolvedValue({ _id: "report-1", caseId: "CASE-1" });

      await createReport(req, res, next);

      expect(StrayReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          animalType: "dog",
          categories: ["Injured", "Abandoned"],
          category: "Injured, Abandoned",
          notes: "Needs urgent help",
          location: { lat: 6.9271, lng: 79.8612, address: "Colombo" },
          photos: ["photo-1"],
          anonymous: false,
          reporterUserId: "reporter-1",
          status: "Needs Help",
          timeline: [expect.objectContaining({ status: "Needs Help", message: "Case reported by Asha" })],
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Report submitted successfully" }));
    });

    it("does not attach a user to anonymous reports", async () => {
      req.user = { id: "reporter-1" };
      req.body = {
        animalType: "Cat",
        categories: ["Abandoned"],
        location: { lat: 6.9, lng: 79.8 },
        photos: ["photo-1"],
        anonymous: "true",
        preventAutoMatch: true,
      };
      StrayReport.create.mockResolvedValue({ _id: "report-2", caseId: "CASE-2" });

      await createReport(req, res, next);

      expect(User.findById).not.toHaveBeenCalled();
      const anonymousPayload = StrayReport.create.mock.calls[0][0];
      expect(anonymousPayload).toEqual(expect.objectContaining({ anonymous: true }));
      expect(anonymousPayload).not.toHaveProperty("reporterUserId");
    });

    it("rejects a report without valid photos, categories, and location", async () => {
      req.body = { animalType: "Dog", categories: ["Unknown"], photos: [], location: { lat: 99, lng: 200 } };

      await createReport(req, res, next);

      expect(StrayReport.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: "Please correct the invalid report fields.",
        errors: expect.objectContaining({ categories: expect.any(String), photos: expect.any(String), location: expect.any(String) }),
      }));
    });
  });

  describe("acceptReportFromMap", () => {
    const acceptedReport = {
      caseId: "SC-123",
      animalType: "dog",
      reporterUserId: "reporter-1",
      anonymous: false,
      notes: "Injured paw",
      photos: ["photo-1"],
    };

    it("accepts an available case and sends the reporter a structured case notification", async () => {
      req.user = { id: "rescuer-user" };
      req.params = { caseId: "SC-123" };
      User.findById.mockReturnValue(selectResult({ name: "Nimal", role: "rescuer" }));
      Rescuer.findOne.mockResolvedValue({ _id: "rescuer-1", name: "Nimal" });
      StrayReport.findOneAndUpdate.mockResolvedValue(acceptedReport);
      RescueRequest.create.mockResolvedValue({ _id: "request-1" });

      await acceptReportFromMap(req, res);

      expect(StrayReport.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: "SC-123", status: "Needs Help" }),
        expect.objectContaining({ $set: { status: "Under Rescue", assignedRescuerId: "rescuer-1" } }),
        { new: true }
      );
      expect(NotificationService.sendNotification).toHaveBeenCalledWith(
        "reporter-1",
        "Case SC-123 Accepted",
        expect.stringContaining("dog rescue case SC-123 was accepted by Nimal"),
        "success",
        "request-1",
        "SC-123",
        expect.objectContaining({
          event: "rescue_accepted",
          status: "Under Rescue",
          animalType: "dog",
          assignedRescuerName: "Nimal",
          action: "view_case",
          categoryId: "case_update",
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("does not notify the reporter when the accepted report is anonymous", async () => {
      req.user = { id: "rescuer-user" };
      req.params = { caseId: "SC-123" };
      User.findById.mockReturnValue(selectResult({ name: "Nimal", role: "rescuer" }));
      Rescuer.findOne.mockResolvedValue({ _id: "rescuer-1", name: "Nimal" });
      StrayReport.findOneAndUpdate.mockResolvedValue({ ...acceptedReport, anonymous: true, reporterUserId: undefined });
      RescueRequest.create.mockResolvedValue({ _id: "request-1" });

      await acceptReportFromMap(req, res);

      expect(NotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe("updateCaseStatus", () => {
    const assignedRequest = { rescuerId: "rescuer-1" };

    const setupAssignedRescuer = () => {
      req.user = { id: "rescuer-user" };
      req.params = { caseId: "SC-123" };
      User.findById.mockImplementation((id: string) =>
        selectResult(id === "reporter-1" ? { name: "Asha" } : { name: "Nimal", role: "rescuer" })
      );
      Rescuer.findOne.mockResolvedValue({ _id: "rescuer-1" });
      RescueRequest.findOne.mockResolvedValue(assignedRequest);
    };

    it("moves an assigned case to Treated and sends case-specific notification metadata", async () => {
      setupAssignedRescuer();
      req.body = { status: "Treated" };
      const report = {
        caseId: "SC-123", animalType: "dog", status: "Under Rescue", anonymous: false,
        reporterUserId: "reporter-1", timeline: [], save: jest.fn().mockResolvedValue(undefined),
      };
      StrayReport.findOne.mockResolvedValue(report);

      await updateCaseStatus(req, res, next);

      expect(report.status).toBe("Treated");
      expect(report.timeline).toEqual([expect.objectContaining({ status: "Treated", rescuerName: "Nimal" })]);
      expect(report.save).toHaveBeenCalledTimes(1);
      expect(NotificationService.sendNotification).toHaveBeenCalledWith(
        "reporter-1",
        "Treatment Started â€¢ SC-123",
        expect.stringContaining("SC-123: the dog is now receiving treatment"),
        "success",
        "",
        "SC-123",
        expect.objectContaining({ event: "case_status_updated", status: "Treated", action: "view_case" })
      );
    });

    it("moves a treated case to Ready for Adoption without notifying anonymous reporters", async () => {
      setupAssignedRescuer();
      req.body = { status: "Ready for Adoption" };
      const report = {
        caseId: "SC-124", animalType: "cat", status: "Treated", anonymous: true,
        timeline: [], save: jest.fn().mockResolvedValue(undefined),
      };
      req.params = { caseId: "SC-124" };
      StrayReport.findOne.mockResolvedValue(report);

      await updateCaseStatus(req, res, next);

      expect(report.status).toBe("Ready for Adoption");
      expect(report.save).toHaveBeenCalledTimes(1);
      expect(NotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it("rejects invalid status transitions before saving or notifying", async () => {
      setupAssignedRescuer();
      req.body = { status: "Ready for Adoption" };
      StrayReport.findOne.mockResolvedValue({ caseId: "SC-123", status: "Under Rescue" });

      await updateCaseStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Status cannot change from Under Rescue to Ready for Adoption." });
      expect(RescueRequest.findOne).not.toHaveBeenCalled();
      expect(NotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });
});
