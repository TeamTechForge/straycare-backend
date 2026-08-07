import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
import { NotificationService } from "../services/NotificationService";
const StrayReport = require("../models/strayreport");

import type { Request, Response } from "express";

// Helper function to send push notifications via Expo
const sendPushNotification = async (
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body: message,
        data: data || {},
      }),
    });

    if (!response.ok) {
      console.error("[PUSH] Expo push service error:", response.status);
    }
  } catch (error) {
    console.error("[PUSH] Failed to send push notification:", error);
    throw error;
  }
};

const parseMaybeJson = (value: any): any => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const normalizePhotos = (payload: any, files: any[] = []): string[] => {
  const bodyPhotos = parseMaybeJson(payload.photos);
  const bodyFileIds = parseMaybeJson(payload.fileIds || payload.photoIds);

  const normalized: string[] = [];

  if (Array.isArray(bodyPhotos)) normalized.push(...bodyPhotos);
  if (Array.isArray(bodyFileIds)) normalized.push(...bodyFileIds);
  if (Array.isArray(files) && files.length > 0) {
    normalized.push(...files.map((file: any) => String(file.id)));
  }

  return [...new Set(normalized.map((id) => String(id)))];
};

const normalizeLocation = (rawLocation: any): { lat: number; lng: number; address?: string } | null => {
  const location = parseMaybeJson(rawLocation);

  if (!location || typeof location !== "object") {
    return null;
  }

  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return {
      lat: Number(location.coordinates[1]),
      lng: Number(location.coordinates[0]),
      address: location.address,
    };
  }

  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    address: location.address,
  };
};

const normalizeAnonymous = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

const normalizeStatus = (value: any): string => {
  const allowed = ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption"];
  return allowed.includes(value) ? value : "Needs Help";
};

interface IStrayReportDTO {
  caseId: string;
  animalType?: string;
  location: { lat: number; lng: number; address?: string } | null;
  photos: string[];
  anonymous: boolean;
  status: string;
  reporterUserId?: string;
  [key: string]: any;
}

const buildReportPayload = (req: Request): IStrayReportDTO => {
  const payload: any = { ...req.body };

  payload.location = normalizeLocation(payload.location);
  payload.photos = normalizePhotos(payload, (req as any).files);
  payload.anonymous = normalizeAnonymous(payload.anonymous);
  payload.status = normalizeStatus(payload.status);

  // Generate unique caseId using timestamp + random suffix to prevent collisions
  if (!payload.caseId) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    payload.caseId = `CASE-${timestamp}-${randomSuffix}`;
  }

  if (req.user && req.user.id) {
    payload.reporterUserId = req.user.id;
  }

  return payload as IStrayReportDTO;
};

//  1. CREATE REPORT
exports.createReport = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const reportPayload = buildReportPayload(req);
    console.log("[STRAY][POST] Creating report with payload:", { caseId: reportPayload.caseId, animalType: reportPayload.animalType, location: reportPayload.location });

    if (!reportPayload.animalType) {
      console.warn("[STRAY][VALIDATION] animalType is missing");
      res.status(400).json({ message: "animalType is required" });
      return;
    }

    if (
      !reportPayload.location ||
      !Number.isFinite(reportPayload.location.lat) ||
      !Number.isFinite(reportPayload.location.lng)
    ) {
      console.warn("[STRAY][VALIDATION] location is invalid:", reportPayload.location);
      res.status(400).json({ message: "location with lat/lng is required" });
      return;
    }

    // Initial timeline entry
    reportPayload.timeline = [
      {
        status: reportPayload.status,
        message: "Case created",
        timestamp: new Date(),
      },
    ];

    try {
      const newReport = await StrayReport.create(reportPayload);
      console.log("[STRAY][SUCCESS] Report created:", newReport._id);

      // ────────────────────────────────────────────────────────
      // AUTOMATIC NEAREST RESCUER LOOKUP & REQUEST
      // ────────────────────────────────────────────────────────
      let rescueRequest = null;
      if (req.body.preventAutoMatch !== true) {
        try {
          const { RescueService } = require("../services/RescueService");
          const User = require("../models/User");
          
          const reporterUser = req.user ? await User.findById(req.user.id) : null;
          
          console.log(`[STRAY] Attempting automatic rescuer matching within 5km for report ${newReport.caseId}`);
          const nearestResult = await RescueService.findNearestRescuer({
            latitude: newReport.location.lat,
            longitude: newReport.location.lng,
            caseId: newReport.caseId,
            maxDistanceKm: 5,
          });

        if (nearestResult) {
          const distanceKm = Number(nearestResult.distance);
          const etaMinutes = Math.max(3, Math.round(distanceKm * 6));
          const requestPayload = {
            userId: newReport.reporterUserId || String(reporterUser?._id) || "anonymous",
            caseId: newReport.caseId,
            animalType: newReport.animalType,
            description: newReport.description || "Stray animal needs help",
            photos: newReport.photos || [],
            reporterName: reporterUser?.name || "Reporter",
            reporterPhone: reporterUser?.phone || "",
            reporterAvatar: reporterUser?.profileImage || "",
            reporterLocation: {
              latitude: newReport.location.lat,
              longitude: newReport.location.lng,
              address: newReport.location.address || "",
            },
            rescueLocation: {
              latitude: newReport.location.lat,
              longitude: newReport.location.lng,
              address: newReport.location.address || "",
            },
            distanceKm,
            etaMinutes,
            summary: newReport.description || "Automatic rescue assignment",
          };

          rescueRequest = await RescueService.createRescueRequest(requestPayload, nearestResult.rescuer);
          console.log(`[STRAY] Successfully sent request ${rescueRequest._id} to nearest rescuer ${nearestResult.rescuer.name}`);
        } else {
          console.log("[STRAY] No available rescuers found for this case");
        }
      } catch (err: any) {
        console.error("[STRAY] Automatic rescue matching failed:", err.message || err);
      }
    }

      res.status(201).json({
        message: "Report submitted successfully",
        request: newReport,
        rescueRequest,
      });
    } catch (error: any) {
      // Handle duplicate key error (E11000)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        console.warn(`[STRAY][DUPLICATE] Duplicate ${field}:`, error.keyValue);
        res.status(409).json({
          message: `A report with this ${field} already exists. Please refresh and try again.`,
          code: "DUPLICATE_KEY",
          field: field,
        });
        return;
      }
      // Re-throw other errors to be handled by global error handler
      throw error;
    }
  });;

// 2. GET REPORT BY CASE ID (with reporter details if not anonymous)
exports.getReportByCaseId = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const report: any = await StrayReport.findOne({ caseId: req.params.caseId });

    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }

    // If report is not anonymous, populate reporter details
    if (!report.anonymous && report.reporterUserId) {
      const User = require("../models/User");
      try {
        const reporter = await User.findById(report.reporterUserId).select("name phone email role profileImage");
        if (reporter) {
          report._doc.reporter = {
            id: reporter._id,
            name: reporter.name,
            phone: reporter.phone,
            email: reporter.email,
            role: reporter.role,
            profileImage: reporter.profileImage,
          };
        }
      } catch (err) {
        console.warn(`[STRAY] Could not populate reporter for case ${report.caseId}:`, err);
      }
    }

    res.json(report);
  });;

// 3. GET ALL REPORTS
exports.getAllReports = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Hide cases that are currently pending assignment to a specific rescuer
    const RescueRequest = require("../models/RescueRequest");
    const pendingRequests = await RescueRequest.find({ status: "pending" });
    const pendingCaseIds = pendingRequests.map((r: any) => r.caseId).filter(Boolean);

    const reports = await StrayReport.find({ caseId: { $nin: pendingCaseIds } }, {
      status: 1,
      location: 1,
      caseId: 1,
      animalType: 1,
      anonymous: 1,
      reporterUserId: 1,
      description: 1,
      category: 1,
      photos: 1,
      createdAt: 1
    });
    console.log("[STRAY][GET] Fetched all reports (excluding pending rescue assignments):", reports.length);
    res.json(reports);
  });;

// 4. UPDATE CASE STATUS (RESCUERS ONLY)
exports.updateCaseStatus = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    // 🔒 Check if user is authenticated
    if (!userId) {
      res.status(401).json({ message: "Unauthorized. Please login first." });
      return;
    }

    // 🔒 Check if user is a rescuer/volunteer/ngo/vet
    const User = require("../models/User");
    const user = await User.findById(userId).select("name role");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const rescuerRoles = ["volunteer", "ngo", "vet", "rescuer"];
    if (!rescuerRoles.includes(user.role)) {
      console.warn(`[STRAY][UNAUTHORIZED] User ${userId} (role: ${user.role}) attempted to update case status`);
      res.status(403).json({
        message: "Only rescuers, volunteers, NGOs, and veterinarians can update case status.",
        requiredRole: "rescuer/volunteer/ngo/vet",
        userRole: user.role,
      });
      return;
    }

    const report = await StrayReport.findOne({ caseId });

    if (!report) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    // 🔒 Check if case is assigned to a rescuer — only assigned rescuer can manage/update status
    const RescueRequest = require("../models/RescueRequest");
    const Rescuer = require("../models/Rescuer");

    const activeRequest = await RescueRequest.findOne({
      caseId,
      status: { $in: ["pending", "accepted", "Under Rescue"] },
    });

    if (activeRequest && activeRequest.rescuerId) {
      const rescuerDoc = await Rescuer.findOne({ userId });
      if (!rescuerDoc || String(activeRequest.rescuerId) !== String(rescuerDoc._id)) {
        res.status(403).json({
          message: "Forbidden. Only the assigned rescuer can manage or update status for this case.",
        });
        return;
      }
    }

    // Update main status
    report.status = status;

    // Ensure timeline exists
    if (!report.timeline) {
      report.timeline = [];
    }

    // Add new timeline entry with rescuer info
    report.timeline.push({
      status,
      message: `Status changed to ${status} by ${user.name} (${user.role})`,
      rescuerId: userId,
      rescuerName: user.name,
      rescuerRole: user.role,
      timestamp: new Date(),
    });

    await report.save();

    // 🔔 Notify reporter of status update (if not anonymous)
    if (!report.anonymous && report.reporterUserId) {
      const statusMessages: { [key: string]: string } = {
        "Needs Help": "Your case has been reported",
        "Under Rescue": "A rescuer has accepted your case and is on the way",
        "Treated": "Your animal has been treated and is recovering",
        "Ready for Adoption": "Your animal is ready for adoption"
      };

      const notificationMessage = statusMessages[status] || `Status updated to ${status}`;

      try {
        // Save in-app notification
        await NotificationService.sendNotification(
          report.reporterUserId,
          "Case Status Update",
          notificationMessage,
          "success"
        );
        console.log(`[STRAY] Notification sent to reporter for case ${report.caseId}`);

        // Send push notification if user has token
        try {
          const reporterUser = await User.findById(report.reporterUserId).select("pushToken");
          if (reporterUser?.pushToken) {
            await sendPushNotification(
              reporterUser.pushToken,
              "Case Status Update",
              notificationMessage,
              { caseId: report.caseId, status, type: "success" }
            );
            console.log(`[STRAY] Push notification sent to reporter for case ${report.caseId}`);
          }
        } catch (pushErr: any) {
          console.warn(`[STRAY] Failed to send push notification:`, pushErr.message);
        }
      } catch (err: any) {
        console.warn(`[STRAY] Failed to send reporter notification:`, err.message);
      }
    }

    res.json(report);
  });;

// 5. GET USER NOTIFICATIONS
exports.getUserNotifications = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized. Please login first." });
    return;
  }

  const Notification = require("../models/Notification");
  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(notifications);
});;

// 6. MARK NOTIFICATION AS READ
exports.markNotificationRead = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { notificationId } = req.params;

  if (!notificationId) {
    res.status(400).json({ message: "notificationId is required" });
    return;
  }

  const Notification = require("../models/Notification");
  const notification = await Notification.findByIdAndUpdate(
    notificationId,
    { read: true },
    { new: true }
  );

  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  res.json(notification);
});
