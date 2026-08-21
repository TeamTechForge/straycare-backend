jest.unmock("../../../src/services/notificationService");
jest.mock("../../../src/models/Notification", () => ({ create: jest.fn() }));
jest.mock("../../../src/models/User", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock("../../../src/utils/logger", () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import mongoose from "mongoose";
import { NotificationService } from "../../../src/services/notificationService";

const Notification = require("../../../src/models/Notification");
const User = require("../../../src/models/User");
const validUserId = new mongoose.Types.ObjectId().toString();

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("persists case metadata and sends Expo-compatible action data", async () => {
    Notification.create.mockResolvedValue({});
    User.findById.mockResolvedValue({ pushToken: "ExponentPushToken[valid-token]" });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { status: "ok" } }),
    });

    await NotificationService.sendNotification(
      validUserId,
      "Case SC-101 Accepted",
      "Your dog rescue case was accepted.",
      "success",
      "request-1",
      "SC-101",
      {
        event: "rescue_accepted",
        status: "Under Rescue",
        animalType: "dog",
        assignedRescuerName: "Nimal",
        action: "view_case",
        categoryId: "case_update",
      }
    );

    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: validUserId,
      caseId: "SC-101",
      event: "rescue_accepted",
      action: "view_case",
    }));
    expect(global.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        to: "ExponentPushToken[valid-token]",
        categoryId: "case_update",
        data: expect.objectContaining({ caseId: "SC-101", event: "rescue_accepted" }),
      })
    );
  });

  it("removes a device token rejected as no longer registered", async () => {
    Notification.create.mockResolvedValue({});
    User.findById.mockResolvedValue({ pushToken: "ExpoPushToken[stale-token]" });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { status: "error", details: { error: "DeviceNotRegistered" } } }),
    });

    await NotificationService.sendNotification(validUserId, "Case update", "Updated", "success");

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(validUserId, { $unset: { pushToken: 1 } });
  });

  it("does not call Expo for a malformed stored token and clears it", async () => {
    Notification.create.mockResolvedValue({});
    User.findById.mockResolvedValue({ pushToken: "not-an-expo-token" });

    await NotificationService.sendNotification(validUserId, "Case update", "Updated", "success");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(validUserId, { $unset: { pushToken: 1 } });
  });
});
