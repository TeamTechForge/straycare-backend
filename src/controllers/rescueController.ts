import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
// This file contains the actual logic for each rescue-related API endpoint.
// Each function is called by a route in rescueRoutes.js.

const mongoose = require("mongoose");
const Rescuer = require("../models/Rescuer");
const RescueRequest = require("../models/RescueRequest");
const RescueHistory = require("../models/RescueHistory");
const { getDistance } = require("../utils/distance");

import { NotificationService } from "../services/notificationService";
import { RescueService } from "../services/rescueService";
import { Logger } from "../utils/logger";
import { RescueMathHelper } from "../utils/rescueMathHelper";
import { RescueStatus } from "../enums/RescueStatus";
import type { Request, Response } from "express";

const findRequestByIdOrCustomId = async (id: string): Promise<any> => {
  let request = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    request = await RescueRequest.findById(id).populate("rescuerId");
  }
  if (!request) {
    request = await RescueRequest.findOne({ rescueRequestId: id }).populate("rescuerId");
  }
  if (!request) {
    request = await RescueRequest.findOne({ caseId: id }).sort({ createdAt: -1 }).populate("rescuerId");
  }
  return request;
};

const FALLBACK_RESCUE_LOCATION = {
  latitude: 6.9271,
  longitude: 79.8612,
  address: "Colombo, Sri Lanka",
};

const DEFAULT_RESCUE_PHOTO = "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop&q=80";

const getIsoString = (value: any): string => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

const toArray = (value: any): any[] => (Array.isArray(value) ? value : value ? [value] : []);

const normalizePhotoList = (value: any): string[] => {
  const photos = toArray(value).filter((photo: any) => typeof photo === "string" && photo.trim().length > 0);
  return photos.length ? photos : [DEFAULT_RESCUE_PHOTO];
};

const formatCaseRecord = ({ request, rescuer = null, history = null }: { request: any; rescuer?: any; history?: any }): any => {
  const requestId = String(request.rescueRequestId || request._id);
  const rescueLocation = RescueMathHelper.normalizeLocation(
    request.rescueLocation || rescuer?.location,
    rescuer?.location || FALLBACK_RESCUE_LOCATION,
    0
  );
  const reporterLocation = RescueMathHelper.normalizeLocation(request.reporterLocation, rescueLocation, 0.008);
  const distanceKm = RescueMathHelper.toNumber(request.distanceKm, RescueMathHelper.deriveDistance(reporterLocation, rescueLocation));
  const etaMinutes = RescueMathHelper.toNumber(request.etaMinutes, RescueMathHelper.deriveEta(distanceKm as number));
  const rescuerFromModel = rescuer
    ? {
      id: String(rescuer._id),
      userId: rescuer.userId ? String(rescuer.userId) : "",
      name: rescuer.name,
      avatar: rescuer.avatar || "",
      phone: rescuer.phone || "",
      location: RescueMathHelper.normalizeLocation(rescuer.location, FALLBACK_RESCUE_LOCATION, 0),
    }
    : null;

  const rescuerFromData = history || request.rescuerName
    ? {
      id: history?.rescuerId || request.rescuerId || "",
      userId: "",
      name: history?.rescuerName || request.rescuerName || "",
      avatar: history?.rescuerAvatar || request.rescuerAvatar || "",
      phone: history?.rescuerPhone || request.rescuerPhone || "",
      location: RescueMathHelper.normalizeLocation(history?.rescuerLocation || request.rescueLocation, rescueLocation, 0),
    }
    : null;

  const finalRescuer = rescuerFromModel
    ? { ...rescuerFromData, ...rescuerFromModel }
    : rescuerFromData;

  const photosList = normalizePhotoList(request.photos || history?.photos);

  return {
    rescueRequestId: requestId,
    caseId: request.caseId || requestId,
    status: history ? history.status : request.status,
    animalType: request.animalType || history?.animalType || "Rescue case",
    description: request.description || request.notes || history?.description || "Pending rescue request",
    photos: photosList,
    photoUrl: photosList[0] || DEFAULT_RESCUE_PHOTO,
    createdAt: getIsoString(request.createdAt),
    updatedAt: getIsoString(request.updatedAt || request.createdAt),
    completedAt: history?.completedAt ? getIsoString(history.completedAt) : null,
    reporterName: request.reporterName || history?.reporterName || "Reporter",
    reporterPhone: request.reporterPhone || history?.reporterPhone || "",
    reporterAvatar: request.reporterAvatar || history?.reporterAvatar || "",
    reporter: {
      id: request.userId || history?.userId || request.reporterId || requestId,
      name: request.reporterName || history?.reporterName || "Reporter",
      phone: request.reporterPhone || history?.reporterPhone || "",
      avatar: request.reporterAvatar || history?.reporterAvatar || "",
      location: reporterLocation,
    },
    user: {
      name: request.reporterName || history?.reporterName || "Reporter",
      phone: request.reporterPhone || history?.reporterPhone || "",
    },
    rescuer: finalRescuer,
    location: rescueLocation,
    rescueLocation: rescueLocation,
    distanceKm,
    etaMinutes,
    summary: request.summary || history?.summary || "Pending rescue request",
  };
};

const enrichCaseRecordWithReporterAndStray = async (formatted: any, caseIdOrId: string = "", requestOrHistoryUser: string = "") => {
  try {
    const User = require("../models/User");
    const StrayReport = require("../models/StrayReport");

    const mongoose = require("mongoose");
    const isObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);
    
    const queryConditions: any[] = [];
    if (caseIdOrId) {
      queryConditions.push({ caseId: caseIdOrId });
      if (isObjectId(caseIdOrId)) queryConditions.push({ _id: caseIdOrId });
    }
    if (formatted.caseId) {
      queryConditions.push({ caseId: formatted.caseId });
      if (isObjectId(formatted.caseId)) queryConditions.push({ _id: formatted.caseId });
    }

    let stray = null;
    if (queryConditions.length > 0) {
      stray = await StrayReport.findOne({ $or: queryConditions });
    }

    if (stray) {
      if (stray.caseId) formatted.caseId = stray.caseId;
      if (stray.status) formatted.status = stray.status;
      if (stray.animalType) formatted.animalType = stray.animalType;
      if (stray.notes || stray.description) {
        formatted.description = stray.notes || stray.description;
      }
      if (Array.isArray(stray.photos) && stray.photos.length > 0) {
        const photosList = normalizePhotoList(stray.photos);
        formatted.photos = photosList;
        formatted.photoUrl = photosList[0];
      }
      if (stray.location && (stray.location.lat !== undefined || stray.location.latitude !== undefined)) {
        const lat = stray.location.lat ?? stray.location.latitude;
        const lng = stray.location.lng ?? stray.location.longitude;
        if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
          formatted.location = {
            latitude: Number(lat),
            longitude: Number(lng),
            address: stray.location.address || formatted.location?.address || "",
          };
          formatted.rescueLocation = formatted.location;
        }
      }
      if (stray.timeline && stray.timeline.length > 0) {
        formatted.timeline = stray.timeline;
      }
    }

    // Resolve reporter's user ID: prefer StrayReport.reporterUserId, then RescueRequest.userId
    const reporterUserId =
      stray?.reporterUserId ||
      formatted.reporterUserId ||
      formatted.reporterId ||
      formatted.reporter?.id ||
      requestOrHistoryUser;

    if (stray?.anonymous || formatted.anonymous) {
      formatted.reporterName = "Anonymous Reporter";
      formatted.reporterAvatar = "";
      formatted.reporterPhone = "";
      if (formatted.reporter) {
        formatted.reporter.name = "Anonymous Reporter";
        formatted.reporter.avatar = "";
        formatted.reporter.phone = "";
      }
      return formatted;
    }

    if (reporterUserId && mongoose.Types.ObjectId.isValid(reporterUserId)) {
      const reporterUser = await User.findById(reporterUserId).select("name phone email profileImage avatar");
      if (reporterUser) {
        const name = reporterUser.name || formatted.reporterName || "Reporter";
        const phone = reporterUser.phone || formatted.reporterPhone || "";
        const avatar = reporterUser.profileImage || reporterUser.avatar || formatted.reporterAvatar || "";

        formatted.reporterName = name;
        formatted.reporterPhone = phone;
        formatted.reporterAvatar = avatar;

        formatted.reporter = {
          id: String(reporterUser._id),
          name,
          phone,
          avatar,
          profileImage: avatar,
          email: reporterUser.email || "",
          location: formatted.location,
        };
      }
    }

    // 5. Enrich Assigned Rescuer details (name, avatar, phone)
    const Rescuer = require("../models/Rescuer");
    const rescuerId = formatted.rescuer?.id || formatted.rescuerId;
    let rescuerUserId = formatted.rescuer?.userId;

    let rescuerDoc = null;
    if (rescuerId && mongoose.Types.ObjectId.isValid(String(rescuerId))) {
      rescuerDoc = await Rescuer.findById(rescuerId);
    }

    if (rescuerDoc && rescuerDoc.userId) {
      rescuerUserId = String(rescuerDoc.userId);
    }

    let rescuerUser = null;
    if (rescuerUserId && mongoose.Types.ObjectId.isValid(String(rescuerUserId))) {
      rescuerUser = await User.findById(rescuerUserId).select("name phone profileImage avatar");
    }

    const rName = rescuerUser?.name || rescuerDoc?.name || formatted.rescuer?.name || formatted.rescuerName || "";
    const rPhone = rescuerUser?.phone || rescuerDoc?.phone || formatted.rescuer?.phone || formatted.rescuerPhone || "";
    const rAvatar = rescuerUser?.profileImage || rescuerUser?.avatar || rescuerDoc?.avatar || formatted.rescuer?.avatar || formatted.rescuerAvatar || "";

    if (rName || rAvatar) {
      formatted.rescuerName = rName;
      formatted.rescuerAvatar = rAvatar;
      formatted.rescuerPhone = rPhone;

      if (formatted.rescuer) {
        formatted.rescuer.name = rName || formatted.rescuer.name;
        formatted.rescuer.avatar = rAvatar || formatted.rescuer.avatar;
        formatted.rescuer.phone = rPhone || formatted.rescuer.phone;
        if (rescuerUserId) formatted.rescuer.userId = String(rescuerUserId);
      } else if (rescuerDoc) {
        formatted.rescuer = {
          id: String(rescuerDoc._id),
          userId: rescuerUserId ? String(rescuerUserId) : "",
          name: rName,
          phone: rPhone,
          avatar: rAvatar,
          location: rescuerDoc.location ? { latitude: rescuerDoc.location.latitude, longitude: rescuerDoc.location.longitude } : null,
        };
      }
    }
  } catch (err: any) {
    console.warn("[RESCUE] Error enriching case record:", err.message || err);
  }

  return formatted;
};

// Returns all rescuers in the database.
exports.listRescuers = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rescuers = await Rescuer.find({});
    console.log(`[RESCUE] Found ${rescuers.length} rescuers in database`);
    res.json({ count: rescuers.length, rescuers });
  });;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/rescue/find-nearest
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.findNearestRescuer = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { latitude, longitude, excludeIds, caseId, maxDistanceKm } = req.body;
    const maxDist = maxDistanceKm !== undefined && Number.isFinite(Number(maxDistanceKm)) ? Number(maxDistanceKm) : 5;
    console.log(`[RESCUE] Finding nearest rescuer to lat:${latitude} lng:${longitude} within ${maxDist}km, excluding: ${excludeIds || "none"}, caseId: ${caseId || "none"}`);

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "latitude and longitude are required" });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "latitude and longitude must be valid numbers" });
      return;
    }

    const reporterUserId = req.user ? req.user.id : req.body.reporterUserId;

    const result = await RescueService.findNearestRescuer({
      latitude: lat,
      longitude: lng,
      excludeIds,
      caseId,
      maxDistanceKm: maxDist,
      reporterUserId,
    });

    if (!result) {
      res.status(404).json({ error: `No rescuers available within ${maxDist}km right now. Please try again later.` });
      return;
    }

    console.log(`[RESCUE] Nearest rescuer: ${result.rescuer.name} at ${result.distance} km`);

    res.json(result);
  });;

// POST /api/rescue/send-request
exports.sendRescueRequest = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      rescuerId,
      caseId,
      animalType,
      description,
      notes,
      photos,
      reporterName,
      reporterAvatar,
      reporterPhone,
      reporterLocation,
      rescueLocation,
      distanceKm,
      etaMinutes,
      summary,
      userId,
    } = req.body;
    Logger.info(`Sending request to rescuer ID: ${rescuerId} for user ID: ${userId || "logged-in-user"}`, { service: "RescueController" });

    if (!rescuerId) {
      res.status(400).json({ error: "rescuerId is required" });
      return;
    }

    const rescuer = await Rescuer.findById(rescuerId);
    if (!rescuer) {
      res.status(404).json({ error: "Rescuer not found" });
      return;
    }

    let stray = null;
    if (caseId) {
      const StrayReport = require("../models/StrayReport");
      stray = await StrayReport.findOne({ caseId });
    }

    const User = require("../models/User");
    const reporterUserId = stray?.reporterUserId || userId || req.body.reporterId || (req.user ? req.user.id : undefined);
    let reporterUser = null;
    if (reporterUserId && mongoose.Types.ObjectId.isValid(reporterUserId)) {
      reporterUser = await User.findById(reporterUserId);
    }

    const isAnon = stray?.anonymous || req.body.anonymous === true || req.body.anonymous === "true";

    const payload = {
      userId: reporterUserId || "logged-in-user",
      caseId: caseId || "",
      animalType: animalType || stray?.animalType || "Unknown animal",
      description: description || notes || stray?.notes || stray?.description || "Pending rescue request",
      photos: (photos && photos.length > 0) ? normalizePhotoList(photos) : (stray?.photos ? normalizePhotoList(stray.photos) : [DEFAULT_RESCUE_PHOTO]),
      reporterName: isAnon ? "Anonymous Reporter" : (reporterUser?.name || reporterName || "Reporter"),
      reporterPhone: isAnon ? "" : (reporterUser?.phone || reporterPhone || req.body.reporterPhone || ""),
      reporterAvatar: isAnon ? "" : (reporterUser?.profileImage || reporterUser?.avatar || reporterAvatar || ""),
      reporterLocation: reporterLocation || (stray?.location ? { latitude: stray.location.lat, longitude: stray.location.lng, address: stray.location.address } : undefined),
      rescueLocation: rescueLocation || (stray?.location ? { latitude: stray.location.lat, longitude: stray.location.lng, address: stray.location.address } : undefined),
      distanceKm: distanceKm ?? null,
      etaMinutes: etaMinutes ?? null,
      summary: summary || description || notes || stray?.notes || stray?.description || "Pending rescue request",
    };

    const request = await RescueService.createRescueRequest(payload, rescuer);

    res.json({
      requestId: String(request._id),
      status: RescueStatus.PENDING,
      rescuer: {
        _id: String(rescuer._id),
        name: rescuer.name,
        phone: rescuer.phone,
        avatar: rescuer.avatar || "",
        location: rescuer.location,
      },
    });
  });;

// PATCH /api/rescue/request/:id/cancel
exports.cancelRescueRequest = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = req.params.id as string;
    console.log(`[RESCUE] Cancel request called with id: ${id}`);

    const request = await findRequestByIdOrCustomId(id);
    if (!request) {
      console.log(`[RESCUE] Cancel: No request found for id: ${id}`);
      res.status(404).json({ error: "Request not found" });
      return;
    }

    request.status = RescueStatus.CANCELLED;
    await request.save();

    console.log(`[RESCUE] Request ${id} cancelled by reporter (DB _id: ${request._id})`);

    // Notify the rescuer immediately via Socket.IO so they don't wait for the next poll.
    // The rescuer's screen joins the room using the request's _id as the rescueId.
    try {
      const io = req.app.get("io");
      if (io) {
        const requestRoomId = String(request._id);
        io.of("/rescue").to(requestRoomId).emit("rescue_cancelled", {
          requestId: requestRoomId,
        });
        console.log(`[RESCUE] Emitted rescue_cancelled to room ${requestRoomId}`);
      }
    } catch (socketErr: any) {
      console.warn("[RESCUE] Failed to emit rescue_cancelled:", socketErr.message || socketErr);
    }

    res.json({ success: true, request });
  });;

exports.listPendingRescues = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const pending = await RescueRequest.find({ status: { $in: [RescueStatus.PENDING, RescueStatus.ACCEPTED] } })
      .sort({ createdAt: -1 })
      .populate("rescuerId");

    res.json(pending.map((request: any) => formatCaseRecord({ request, rescuer: request.rescuerId || null })));
  });;

exports.listCompletedRescues = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const historyEntries = await RescueHistory.find({ status: RescueStatus.COMPLETED }).sort({ completedAt: -1, createdAt: -1 });

    res.json(historyEntries.map((history: any) => formatCaseRecord({ request: history, history })));
  });;

exports.listAllRescues = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const [pending, completed] = await Promise.all([
      RescueRequest.find({ status: { $in: [RescueStatus.PENDING, RescueStatus.ACCEPTED] } }).sort({ createdAt: -1 }).populate("rescuerId"),
      RescueHistory.find({ status: RescueStatus.COMPLETED }).sort({ completedAt: -1, createdAt: -1 }),
    ]);

    const all = [
      ...pending.map((request: any) => formatCaseRecord({ request, rescuer: request.rescuerId || null })),
      ...completed.map((history: any) => formatCaseRecord({ request: history, history })),
    ].sort((left: any, right: any) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

    res.json(all);
  });;

exports.listUserRescues = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let userId = (req.params && req.params.userId) || (req.query && req.query.userId);
    if (!userId || userId === "logged-in-user" || userId === "undefined") {
      userId = req.user?.id ? String(req.user.id) : "";
    }
    Logger.info(`Listing rescues for user ID: ${userId}`, { service: "RescueController" });

    const User = require("../models/User");
    const Rescuer = require("../models/Rescuer");

    let rescuerDoc: any = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      rescuerDoc = await Rescuer.findOne({ $or: [{ userId: userId }, { _id: userId }] });
    }

    const rescuerConditions: any[] = [];
    if (rescuerDoc) {
      rescuerConditions.push({ rescuerId: rescuerDoc._id });
    }
    if (userId) {
      rescuerConditions.push({ rescuerId: userId });
    }

    if (rescuerConditions.length === 0) {
      Logger.info(`No rescuer profile or ID for user ID: ${userId}`, { service: "RescueController" });
      res.json([]);
      return;
    }

    // "Under Rescue" active cases: must be assigned to this rescuer AND accepted
    const activeQuery = {
      $or: rescuerConditions,
      status: { $in: [RescueStatus.ACCEPTED, "accepted", "under rescue", "Under Rescue"] },
    };

    // Completed rescue cases: assigned to this rescuer AND completed
    const completedQuery = {
      $or: rescuerConditions,
      status: { $in: [RescueStatus.COMPLETED, "completed", "Completed"] },
    };

    const [active, completed] = await Promise.all([
      RescueRequest.find(activeQuery).sort({ createdAt: -1 }),
      RescueHistory.find(completedQuery).sort({ completedAt: -1, createdAt: -1 }),
    ]);

    const enrichedActive = await Promise.all(
      active.map(async (request: any) => {
        const enriched = await enrichCaseRecordWithReporterAndStray(request.toObject ? request.toObject() : request);
        return formatCaseRecord({ request: enriched, rescuer: enriched.rescuer || null });
      })
    );

    const enrichedCompleted = await Promise.all(
      completed.map(async (history: any) => {
        const enriched = await enrichCaseRecordWithReporterAndStray(history.toObject ? history.toObject() : history);
        return formatCaseRecord({ request: enriched, history: enriched });
      })
    );

    const all = [...enrichedActive, ...enrichedCompleted].sort((left: any, right: any) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

    Logger.info(`Found ${all.length} assigned rescues for user ID: ${userId}`, { service: "RescueController" });
    res.json(all);
  });;

exports.getRescueById = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    let history = await RescueHistory.findOne({ rescueRequestId: id });
    if (!history) {
      history = await RescueHistory.findOne({ caseId: id });
    }

    if (history) {
      let rescuerDoc = null;
      try {
        const Rescuer = require("../models/Rescuer");
        if (history.rescuerId && mongoose.Types.ObjectId.isValid(history.rescuerId)) {
          rescuerDoc = await Rescuer.findById(history.rescuerId);
        }
      } catch (err: any) {
        console.error("[RESCUE] Failed to look up rescuer for history:", err.message);
      }

      let formatted = formatCaseRecord({ request: history, history, rescuer: rescuerDoc });
      formatted = await enrichCaseRecordWithReporterAndStray(formatted, history.caseId || id, history.userId);

      res.json({
        ...formatted,
        reporterLocation: formatted.reporter.location,
        rescuerLocation: formatted.rescuer?.location || null,
        distanceKm: formatted.distanceKm,
        etaMinutes: formatted.etaMinutes,
        lastUpdatedAt: getIsoString(history.completedAt || history.createdAt),
      });
      return;
    }

    const pendingRequest = await findRequestByIdOrCustomId(String(id));

    if (pendingRequest) {
      let formatted = formatCaseRecord({ request: pendingRequest, rescuer: pendingRequest.rescuerId || null });
      formatted = await enrichCaseRecordWithReporterAndStray(formatted, pendingRequest.caseId || String(id), pendingRequest.userId);

      res.json({
        ...formatted,
        reporterLocation: formatted.reporter.location,
        rescuerLocation: formatted.rescuer?.location || null,
        distanceKm: formatted.distanceKm,
        etaMinutes: formatted.etaMinutes,
        lastUpdatedAt: getIsoString(pendingRequest.updatedAt || pendingRequest.createdAt),
      });
      return;
    }

    res.status(404).json({ error: "Rescue not found" });
  });;

exports.getLiveTracking = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { requestId } = req.params;
    const request = await findRequestByIdOrCustomId(String(requestId));

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    let formatted = formatCaseRecord({ request, rescuer: request.rescuerId || null });
    formatted = await enrichCaseRecordWithReporterAndStray(formatted, request.caseId || String(requestId), request.userId);

    res.json({
      ...formatted,
      reporterLocation: formatted.reporter.location,
      rescuerLocation: formatted.rescuer?.location || null,
      distanceKm: formatted.distanceKm,
      etaMinutes: formatted.etaMinutes,
      lastUpdatedAt: getIsoString(request.updatedAt || request.createdAt),
    });
  });;

exports.checkRequestStatus = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { requestId } = req.params;
    Logger.info(`Checking status of request: ${requestId}`, { service: "RescueController" });

    const request = await findRequestByIdOrCustomId(String(requestId));

    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    // Build full case record with reporter + stray enrichment
    let formatted = formatCaseRecord({ request, rescuer: request.rescuerId || null });
    formatted = await enrichCaseRecordWithReporterAndStray(formatted, request.caseId || String(requestId), request.userId);

    // IMPORTANT: preserve the RescueRequest's actual status (pending/accepted/rejected)
    // enrichCaseRecordWithReporterAndStray may overwrite it with the StrayReport status
    const actualRequestStatus = request.status;

    res.json({
      ...formatted,
      status: actualRequestStatus,
      requestId: String(request._id),
      reporterLocation: formatted.reporter?.location || null,
      rescuerLocation: formatted.rescuer?.location || null,
      distanceKm: formatted.distanceKm,
      etaMinutes: formatted.etaMinutes,
      lastUpdatedAt: getIsoString(request.updatedAt || request.createdAt),
    });
  });;

// GET /api/rescue/active-request
exports.getActiveRescuerRequest = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    // Find the Rescuer document for this user
    const rescuer = await Rescuer.findOne({ userId });
    if (!rescuer) {
      res.json({ request: null });
      return;
    }

    // Find the latest pending request for this rescuer
    const pendingRequest = await RescueRequest.findOne({
      rescuerId: rescuer._id,
      status: RescueStatus.PENDING,
    }).sort({ createdAt: -1 });

    if (!pendingRequest) {
      res.json({ request: null });
      return;
    }

    let formatted = formatCaseRecord({ request: pendingRequest, rescuer });
    formatted = await enrichCaseRecordWithReporterAndStray(formatted, pendingRequest.caseId || String(pendingRequest._id), pendingRequest.userId);

    res.json({ request: formatted });
  });;

// PATCH /api/rescue/request/:id/respond
exports.respondToRescueRequest = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { action } = req.body; // "accept" or "reject"

    if (action !== "accept" && action !== "reject") {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    const request = await RescueRequest.findById(id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (action === "accept" && request.userId && req.user?.id && String(request.userId) === String(req.user.id)) {
      res.status(403).json({ error: "You cannot accept or take a rescue request for a case you reported yourself." });
      return;
    }

    request.status = action === "accept" ? "accepted" : "rejected";
    await request.save();

    console.log(`[RESCUE] Rescuer responded to request ${id} with: ${request.status}`);

    if (action === "accept") {
      // 1. Update StrayReport status to "Under Rescue"
      try {
        const StrayReport = require("../models/StrayReport");
        const report = await StrayReport.findOne({ caseId: request.caseId });
        if (report) {
          report.status = "Under Rescue";
          if (!report.timeline) report.timeline = [];
          report.timeline.push({
            status: "Under Rescue",
            message: `Case accepted by rescuer: ${request.rescuerName || "Rescuer"}`,
            timestamp: new Date(),
          });
          await report.save();
          console.log(`[RESCUE] StrayReport ${request.caseId} updated status to 'Under Rescue'`);
        }
      } catch (err: any) {
        console.error("[RESCUE] Failed to update StrayReport status on accept:", err.message || err);
      }

      if (request.userId && mongoose.Types.ObjectId.isValid(request.userId)) {
        try {
          const rescuer = await Rescuer.findById(request.rescuerId);
          await NotificationService.sendNotification(
            String(request.userId),
            "Rescue Request Accepted",
            `${rescuer.name} has accepted your rescue request and is on their way!`,
            "success"
          );
        } catch (err: any) {
          console.error("[RESCUE] Failed to create notification for reporter:", err.message);
        }
      }
    }

    if (action === "reject") {
      // 2. Trigger circular matching to find the next nearest rescuer
      try {
        console.log(`[RESCUE] Rejection triggered circular matching lookup for caseId: ${request.caseId}`);
        const rejections = await RescueRequest.find({ caseId: request.caseId, status: "rejected" });
        const excludeIds = rejections.map((r: any) => String(r.rescuerId));

        if (request.rescuerId && !excludeIds.includes(String(request.rescuerId))) {
          excludeIds.push(String(request.rescuerId));
        }

        const nextRescuerResult = await RescueService.findNearestRescuer({
          latitude: request.rescueLocation?.latitude || FALLBACK_RESCUE_LOCATION.latitude,
          longitude: request.rescueLocation?.longitude || FALLBACK_RESCUE_LOCATION.longitude,
          excludeIds,
          caseId: request.caseId,
        });

        if (nextRescuerResult) {
          const distanceKm = Number(nextRescuerResult.distance);
          const etaMinutes = Math.max(3, Math.round(distanceKm * 6));

          const nextRequestPayload = {
            userId: request.userId,
            caseId: request.caseId,
            animalType: request.animalType,
            description: request.description,
            photos: request.photos,
            reporterName: request.reporterName,
            reporterPhone: request.reporterPhone,
            reporterAvatar: request.reporterAvatar,
            reporterLocation: request.reporterLocation,
            rescueLocation: request.rescueLocation,
            distanceKm,
            etaMinutes,
            summary: request.summary,
          };

          const nextRescueRequest = await RescueService.createRescueRequest(nextRequestPayload, nextRescuerResult.rescuer);
          console.log(`[RESCUE] Successfully forwarded case ${request.caseId} to next rescuer ${nextRescuerResult.rescuer.name}`);
        } else {
          console.log(`[RESCUE] No more available rescuers found for case ${request.caseId}. Fallback to public map.`);
          const StrayReport = require("../models/StrayReport");
          const report = await StrayReport.findOne({ caseId: request.caseId });
          if (report) {
            report.status = "Needs Help";
            if (!report.timeline) report.timeline = [];
            report.timeline.push({
              status: "Needs Help",
              message: "All nearby rescuers declined. Case is now open for public rescue.",
              timestamp: new Date(),
            });
            await report.save();
            console.log(`[RESCUE] StrayReport ${request.caseId} fallback to public map (status: Needs Help)`);
          }
        }
      } catch (err: any) {
        console.error("[RESCUE] Failed to execute circular matching:", err.message || err);
      }
    }

    res.json({ success: true, request });
  });;

// PATCH /api/rescue/request/:id/details
exports.updateRescueDetails = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { summary, status } = req.body;

    if (!summary && !status) {
      res.status(400).json({ error: "Details/summary or status are required" });
      return;
    }

    let request: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      request = await RescueRequest.findById(id);
    }
    if (!request) {
      request = await RescueRequest.findOne({ rescueRequestId: id });
    }
    if (!request) {
      request = await RescueRequest.findOne({ caseId: id }).sort({ createdAt: -1 });
    }

    let history: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      history = await RescueHistory.findById(id);
    }
    if (!history) {
      history = await RescueHistory.findOne({ rescueRequestId: id });
    }
    if (!history) {
      history = await RescueHistory.findOne({ caseId: id });
    }

    // Authenticate rescuer
    const activeDoc = request || history;
    if (activeDoc && activeDoc.rescuerId && req.user) {
      const rescuerDoc = await Rescuer.findOne({ userId: req.user.id });
      if (!rescuerDoc || String(activeDoc.rescuerId) !== String(rescuerDoc._id)) {
        res.status(403).json({ error: "Forbidden. Only the assigned rescuer can update or manage this case." });
        return;
      }
    }

    // Block updates if the case is already completed
    if (activeDoc && activeDoc.caseId) {
      const StrayReportCheck = require("../models/StrayReport");
      const existingReport = await StrayReportCheck.findOne({ caseId: activeDoc.caseId }).select("status").lean();
      if (existingReport && existingReport.status === "Completed") {
        res.status(400).json({ error: "This rescue case has been completed and can no longer be updated." });
        return;
      }
    }

    const timestamp = new Date().toLocaleString("en-US", { hour12: true });
    let newUpdate = "";

    if (summary) {
      newUpdate = `[${timestamp}] ${summary}`;
      if (activeDoc) {
        if (activeDoc.summary && activeDoc.summary !== "Pending rescue request" && activeDoc.summary !== "Completed rescue" && activeDoc.summary.trim() !== "") {
          activeDoc.summary = `${newUpdate}\n${activeDoc.summary}`;
        } else {
          activeDoc.summary = newUpdate;
        }
      }
    }

    // If status is provided, update StrayReport, and optionally RescueRequest
    let strayReport: any = null;
    if (status && activeDoc && activeDoc.caseId) {
      const StrayReportModel = require("../models/StrayReport");
      strayReport = await StrayReportModel.findOne({ caseId: activeDoc.caseId });
      if (strayReport) {
        strayReport.status = status;
        if (!strayReport.timeline) strayReport.timeline = [];
        strayReport.timeline.push({
          status: status,
          message: summary || `Status updated to ${status}`,
          timestamp: new Date(),
        });
        await strayReport.save();
      }

      if (status === "Completed") {
        activeDoc.status = "completed";
      }
    }

    if (activeDoc) {
      await activeDoc.save();
      res.json({ success: true, doc: activeDoc, report: strayReport });
      return;
    }

    res.status(404).json({ error: "Rescue request or history not found" });
  });;

// POST /api/rescue/accept-from-map
// Allows a rescuer to directly accept a case from the public rescue map
exports.acceptFromMap = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.body;
    const userId = req.user!.id;

    if (!caseId) {
      res.status(400).json({ error: "caseId is required" });
      return;
    }

    // Find rescuer document for this user
    const rescuer = await Rescuer.findOne({ userId });
    if (!rescuer) {
      res.status(403).json({ error: "You are not registered as a rescuer" });
      return;
    }

    // Find the stray report
    const StrayReport = require("../models/StrayReport");
    const report = await StrayReport.findOne({ caseId });
    if (!report) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    // 🔒 Check if user is attempting to accept a case they reported themselves
    if (report.reporterUserId && String(report.reporterUserId) === String(userId)) {
      res.status(403).json({ error: "You cannot accept or take a rescue request for a case you reported yourself." });
      return;
    }

    if (report.status !== "Needs Help") {
      res.status(400).json({ error: `Case is already in status: ${report.status}` });
      return;
    }

    // Create rescue request as already-accepted
    const request = await RescueRequest.create({
      rescuerId: rescuer._id,
      userId: report.reporterUserId || "",
      status: RescueStatus.ACCEPTED,
      caseId,
      animalType: report.animalType || "Unknown animal",
      description: report.notes || "Rescue case accepted from map",
      photos: report.photos || [],
      reporterName: report.reporter?.name || "Reporter",
      reporterPhone: report.reporter?.phone || "",
      reporterAvatar: report.reporter?.profileImage || "",
      rescueLocation: {
        latitude: report.location?.lat || null,
        longitude: report.location?.lng || null,
        address: report.location?.address || "",
      },
      rescuerName: rescuer.name,
      rescuerPhone: rescuer.phone || "",
      rescuerAvatar: rescuer.avatar || "",
      summary: `Accepted by ${rescuer.name} from rescue map`,
    });

    // Update stray report status to "Under Rescue"
    report.status = "Under Rescue";
    if (!report.timeline) report.timeline = [];
    report.timeline.push({
      status: "Under Rescue",
      message: `Case accepted by rescuer: ${rescuer.name}`,
      timestamp: new Date(),
    });
    await report.save();

    console.log(`[RESCUE] Case ${caseId} accepted from map by rescuer ${rescuer.name} (${rescuer._id})`);

    // Notify the reporter
    if (report.reporterUserId && mongoose.Types.ObjectId.isValid(report.reporterUserId)) {
      try {
        await NotificationService.sendNotification(
          String(report.reporterUserId),
          "Rescue Request Accepted",
          `${rescuer.name} has accepted your rescue case and is on their way!`,
          "success",
          String(request._id),
          caseId
        );
      } catch (err: any) {
        console.error("[RESCUE] Failed to notify reporter:", err.message);
      }
    }

    // Emit socket event for real-time updates
    try {
      const io = req.app.get("io");
      if (io) {
        const rescueNamespace = io.of("/rescue");
        rescueNamespace.to(String(request._id)).emit("status_update", {
          status: "Under Rescue",
          rescuerId: String(rescuer._id),
          rescuerName: rescuer.name,
        });
      }
    } catch (err: any) {
      console.error("[RESCUE] Socket emit failed:", err.message);
    }

    res.json({
      success: true,
      requestId: String(request._id),
      request,
      rescuer: {
        _id: String(rescuer._id),
        name: rescuer.name,
        phone: rescuer.phone || "",
        avatar: rescuer.avatar || "",
      },
    });
  });;
