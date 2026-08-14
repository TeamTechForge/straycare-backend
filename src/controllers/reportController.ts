import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
import { NotificationService } from "../services/notificationService";
const StrayReport = require("../models/StrayReport");

import type { Request, Response } from "express";

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

  return [
    ...new Set(
      normalized
        .filter((id) => typeof id === "string" || typeof id === "number")
        .map((id) => String(id).trim())
        .filter(Boolean)
    ),
  ];
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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  "Needs Help": ["Under Rescue"],
  "Under Rescue": ["Treated"],
  Treated: ["Ready for Adoption"],
  "Ready for Adoption": [],
};

const toSafeTimeline = (timeline: any[] = []) =>
  timeline.map((entry) => ({
    status: entry.status,
    message: entry.message,
    actorName: entry.rescuerName || undefined,
    rescuerName: entry.rescuerName || undefined,
    timestamp: entry.timestamp,
  }));

const toSafeReport = (
  report: any,
  reporterName?: string,
  permissions: { canAccept: boolean; canUpdate: boolean } = { canAccept: false, canUpdate: false }
) => ({
  caseId: report.caseId,
  animalType: report.animalType,
  breed: report.breed || "",
  category: report.category || "",
  categories: report.categories || [],
  status: report.status,
  notes: report.notes || report.description || "",
  location: report.location,
  photos: report.photos || [],
  anonymous: Boolean(report.anonymous),
  reportedBy: report.anonymous ? "Anonymous" : reporterName || "Reporter",
  permissions,
  timeline: toSafeTimeline(report.timeline),
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
});

const ALLOWED_CATEGORIES = ["Injured", "Abandoned", "Aggressive"] as const;

type CategoryNormalization = {
  categories: string[];
  invalidCategories: string[];
  hasDuplicates: boolean;
};

const normalizeCategories = (rawCategories: any, rawLegacyCategory: any): CategoryNormalization => {
  const parsedCategories = parseMaybeJson(rawCategories);
  let rawValues: any[] = [];

  if (Array.isArray(parsedCategories)) {
    rawValues = parsedCategories;
  } else if (typeof parsedCategories === "string" && parsedCategories.trim()) {
    rawValues = parsedCategories.split(",");
  } else if (typeof rawLegacyCategory === "string") {
    rawValues = rawLegacyCategory.split(",");
  }

  const normalizedValues = rawValues.map((value) => String(value).trim()).filter(Boolean);
  const uniqueValues = [...new Set(normalizedValues)];
  const invalidCategories = uniqueValues.filter(
    (value) => !ALLOWED_CATEGORIES.includes(value as (typeof ALLOWED_CATEGORIES)[number])
  );

  return {
    categories: uniqueValues.filter((value) => !invalidCategories.includes(value)),
    invalidCategories,
    hasDuplicates: uniqueValues.length !== normalizedValues.length,
  };
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

const buildReportPayload = (
  req: Request
): { reportPayload: IStrayReportDTO; categoryValidation: CategoryNormalization } => {
  const payload: any = { ...req.body };

  const categoryValidation = normalizeCategories(payload.categories, payload.category);

  payload.location = normalizeLocation(payload.location);
  payload.photos = normalizePhotos(payload, (req as any).files);
  payload.anonymous = normalizeAnonymous(payload.anonymous);
  payload.status = normalizeStatus(payload.status);
  payload.animalType = typeof payload.animalType === "string" ? payload.animalType.trim() : "";
  payload.breed = typeof payload.breed === "string" ? payload.breed.trim() : "";
  payload.notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  payload.categories = categoryValidation.categories;
  payload.category = categoryValidation.categories.join(", ");

  if (payload.location?.address && typeof payload.location.address === "string") {
    payload.location.address = payload.location.address.trim();
  }

  // Generate unique caseId using timestamp + random suffix to prevent collisions
  if (!payload.caseId) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    payload.caseId = `CASE-${timestamp}-${randomSuffix}`;
  }

  if (!payload.anonymous && req.user && req.user.id) {
    payload.reporterUserId = req.user.id;
  } else {
    delete payload.reporterUserId;
  }

  return {
    reportPayload: payload as IStrayReportDTO,
    categoryValidation,
  };
};

//  1. CREATE REPORT
exports.createReport = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { reportPayload, categoryValidation } = buildReportPayload(req);
    console.log("[STRAY][POST] Creating report with payload:", { caseId: reportPayload.caseId, animalType: reportPayload.animalType, location: reportPayload.location });

    const validationErrors: Record<string, string> = {};
    if (!reportPayload.animalType || reportPayload.animalType.toLowerCase() === "other") {
      validationErrors.animalType = "Enter a specific animal type.";
    } else if (reportPayload.animalType.length > 50) {
      validationErrors.animalType = "Animal type must be 50 characters or fewer.";
    }
    if (String(reportPayload.breed || "").length > 60) {
      validationErrors.breed = "Breed must be 60 characters or fewer.";
    }
    if (String(reportPayload.notes || "").length > 500) {
      validationErrors.notes = "Condition notes must be 500 characters or fewer.";
    }
    if (categoryValidation.invalidCategories.length > 0) {
      validationErrors.categories = "Categories may only be Injured, Abandoned, or Aggressive.";
    } else if (categoryValidation.hasDuplicates) {
      validationErrors.categories = "Categories must not contain duplicates.";
    } else if (reportPayload.categories.length < 1 || reportPayload.categories.length > 3) {
      validationErrors.categories = "Select between 1 and 3 categories.";
    }
    if (reportPayload.photos.length < 1 || reportPayload.photos.length > 5) {
      validationErrors.photos = "Add between 1 and 5 photos.";
    }
    if (
      !reportPayload.location ||
      !Number.isFinite(reportPayload.location.lat) ||
      reportPayload.location.lat < -90 ||
      reportPayload.location.lat > 90 ||
      !Number.isFinite(reportPayload.location.lng) ||
      reportPayload.location.lng < -180 ||
      reportPayload.location.lng > 180
    ) {
      validationErrors.location = "A valid location with latitude and longitude is required.";
    }

    if (Object.keys(validationErrors).length > 0) {
      console.warn("[STRAY][VALIDATION] Report payload rejected:", {
        caseId: reportPayload.caseId,
        fields: Object.keys(validationErrors),
      });
      res.status(400).json({
        message: "Please correct the invalid report fields.",
        errors: validationErrors,
      });
      return;
    }

    const initialReporter =
      !reportPayload.anonymous && req.user?.id
        ? await require("../models/User").findById(req.user.id).select("name")
        : null;

    // The report is immediately visible on the map as Needs Help.
    reportPayload.timeline = [
      {
        status: reportPayload.status,
        message: `Case reported by ${
          reportPayload.anonymous ? "Anonymous" : initialReporter?.name || "Reporter"
        }`,
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
          const { RescueService } = require("../services/rescueService");
          const User = require("../models/User");
          
          const reporterUser =
            !reportPayload.anonymous && req.user
              ? await User.findById(req.user.id)
              : null;
          
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
            userId: newReport.reporterUserId || "anonymous",
            caseId: newReport.caseId,
            animalType: newReport.animalType,
            description: newReport.notes || newReport.description || req.body.notes || req.body.description || "Stray animal needs help",
            photos: (newReport.photos && newReport.photos.length > 0) ? newReport.photos : (req.body.photos || []),
            reporterName: newReport.anonymous ? "Anonymous Reporter" : (reporterUser?.name || req.body.reporterName || "Reporter"),
            reporterPhone: newReport.anonymous ? "" : (reporterUser?.phone || req.body.reporterPhone || ""),
            reporterAvatar: newReport.anonymous ? "" : (reporterUser?.profileImage || reporterUser?.avatar || req.body.reporterAvatar || ""),
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
            summary: newReport.notes || newReport.description || "Automatic rescue assignment",
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

// 2. GET REPORT BY CASE ID. Return only fields that are safe for case viewers.
exports.getReportByCaseId = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const report: any = await StrayReport.findOne({ caseId: req.params.caseId });

    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }

    let reporterName: string | undefined;
    if (!report.anonymous && report.reporterUserId) {
      const User = require("../models/User");
      try {
        const reporter = await User.findById(report.reporterUserId).select("name");
        if (reporter) {
          reporterName = reporter.name;
        }
      } catch (err) {
        console.warn(`[STRAY] Could not populate reporter for case ${report.caseId}:`, err);
      }
    }

    // Populate assigned rescuer user ID if active rescue request exists
    try {
      const RescueRequest = require("../models/RescueRequest");
      const Rescuer = require("../models/Rescuer");

      const activeRequest = await RescueRequest.findOne({
        caseId: req.params.caseId,
        status: { $in: ["accepted", "under rescue", "Under Rescue", "completed", "treated", "ready for adoption"] },
      });

      if (activeRequest && activeRequest.rescuerId) {
        let rescuerUserId = String(activeRequest.rescuerId);
        const rescuerDoc = await Rescuer.findById(activeRequest.rescuerId);
        if (rescuerDoc && rescuerDoc.userId) {
          rescuerUserId = String(rescuerDoc.userId);
        }
        report._doc.assignedRescuerUserId = rescuerUserId;
      }
    } catch (err) {
      console.warn(`[STRAY] Could not populate assigned rescuer for case ${report.caseId}:`, err);
    }

    let permissions = { canAccept: false, canUpdate: false };
    if (req.user?.id) {
      const User = require("../models/User");
      const Rescuer = require("../models/Rescuer");
      const currentUser = await User.findById(req.user.id).select("role");
      const canRescue = ["volunteer", "ngo", "vet", "rescuer"].includes(currentUser?.role);
      if (canRescue) {
        const rescuer = await Rescuer.findOne({ userId: req.user.id }).select("_id");
        permissions = {
          canAccept: Boolean(rescuer && report.status === "Needs Help" && !report.assignedRescuerId),
          canUpdate: Boolean(rescuer && report.assignedRescuerId && String(report.assignedRescuerId) === String(rescuer._id)),
        };
      }
    }

    res.json(toSafeReport(report, reporterName, permissions));
  });;

// 3. GET ALL REPORTS
exports.getAllReports = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // The map reflects the report's persisted status. A pending rescuer
    // assignment must not hide a newly committed "Needs Help" report.
    const reports = await StrayReport.find({}, {
      status: 1,
      location: 1,
      caseId: 1,
      animalType: 1,
      anonymous: 1,
      description: 1,
      breed: 1,
      category: 1,
      categories: 1,
      photos: 1,
      createdAt: 1
    });
    console.log("[STRAY][GET] Fetched all reports:", reports.length);
    res.json(reports);
  });;

// Accepting from the map belongs to the report workflow and does not alter
// the existing rescue-controller flow.
exports.acceptReportFromMap = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const Rescuer = require("../models/Rescuer");
  const RescueRequest = require("../models/RescueRequest");
  const User = require("../models/User");
  const user = await User.findById(req.user?.id).select("name role");
  const rescuer = user && ["volunteer", "ngo", "vet", "rescuer"].includes(user.role)
    ? await Rescuer.findOne({ userId: req.user?.id })
    : null;
  if (!rescuer) { res.status(403).json({ message: "Only registered rescuers can accept a case." }); return; }

  const report = await StrayReport.findOneAndUpdate(
    { caseId: req.params.caseId, status: "Needs Help", $or: [{ assignedRescuerId: { $exists: false } }, { assignedRescuerId: null }] },
    { $set: { status: "Under Rescue", assignedRescuerId: rescuer._id }, $push: { timeline: { status: "Under Rescue", message: `${user.name} accepted the case. Rescue is under way.`, rescuerName: user.name, timestamp: new Date() } } },
    { new: true }
  );
  if (!report) { res.status(409).json({ message: "This case has already been accepted or is no longer available." }); return; }

  const request = await RescueRequest.create({ rescuerId: rescuer._id, userId: report.reporterUserId || "", status: "accepted", caseId: report.caseId, animalType: report.animalType, description: report.notes || "Rescue case accepted from map", photos: report.photos || [], rescuerName: rescuer.name, summary: `Accepted by ${rescuer.name} from rescue map` });
  if (!report.anonymous && report.reporterUserId) {
    await NotificationService.sendNotification(report.reporterUserId, "Rescue Request Accepted", `${user.name} accepted your case. Rescue is under way.`, "success", String(request._id), report.caseId);
  }
  res.status(201).json({ requestId: String(request._id) });
});

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
    const Rescuer = require("../models/Rescuer");
    const RescueRequest = require("../models/RescueRequest");

    // A role alone is not sufficient: the caller must be the rescuer who
    // accepted this specific case. Pending requests do not grant ownership.
    if (!Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, status)) {
      res.status(400).json({ message: "Invalid case status." });
      return;
    }

    if (!STATUS_TRANSITIONS[report.status]?.includes(status)) {
      res.status(400).json({
        message: `Status cannot change from ${report.status} to ${status}.`,
      });
      return;
    }

    const activeRequest = await RescueRequest.findOne({
      caseId,
      status: { $in: ["accepted", "under rescue", "Under Rescue", "completed", "treated", "ready for adoption"] },
    });

    if (!activeRequest) {
      res.status(403).json({
        message: "Forbidden. A rescuer must accept this case before updating its status.",
      });
      return;
    }

    const rescuerDoc = await Rescuer.findOne({ userId });
    const rescuerDocId = rescuerDoc ? String(rescuerDoc._id) : "";
    const currentUserIdStr = String(userId);
    const assignedRescuerIdStr = String(activeRequest.rescuerId);

    const isAssignedRescuer =
      assignedRescuerIdStr === currentUserIdStr ||
      (rescuerDocId && assignedRescuerIdStr === rescuerDocId);

    if (!isAssignedRescuer) {
      res.status(403).json({
        message: "Forbidden. Only the accepted rescuer assigned to this case can change its status.",
      });
      return;
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
      message: `${user.name} updated the case: ${status}`,
      rescuerId: userId,
      rescuerName: user.name,
      rescuerRole: user.role,
      timestamp: new Date(),
    });

    await report.save();

    // 🔔 Notify reporter of status update (if not anonymous)
    if (!report.anonymous && report.reporterUserId) {
      const statusMessages: { [key: string]: string } = {
        Treated: `${user.name} updated the case: Animal is under treatment.`,
        "Ready for Adoption": `${user.name} updated the case: Rescue completed—ready for adoption.`,
      };

      const notificationMessage = statusMessages[status] || `Status updated to ${status}`;

      try {
        // Save in-app notification
        await NotificationService.sendNotification(
          report.reporterUserId,
          "Case Status Update",
          notificationMessage,
          "success",
          "",
          report.caseId
        );
        console.log(`[STRAY] Notification sent to reporter for case ${report.caseId}`);
      } catch (err: any) {
        console.warn(`[STRAY] Failed to send reporter notification:`, err.message);
      }
    }

    const reporter = !report.anonymous && report.reporterUserId
      ? await User.findById(report.reporterUserId).select("name")
      : null;

    res.json(toSafeReport(report, reporter?.name, { canAccept: false, canUpdate: true }));
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
