"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
// This file contains the actual logic for each rescue-related API endpoint.
// Each function is called by a route in rescueRoutes.js.
const mongoose = require("mongoose");
const Rescuer = require("../models/Rescuer");
const RescueRequest = require("../models/RescueRequest");
const RescueHistory = require("../models/RescueHistory");
const { getDistance } = require("../utils/distance");
const NotificationService_1 = require("../services/NotificationService");
const RescueService_1 = require("../services/RescueService");
const Logger_1 = require("../utils/Logger");
const RescueMathHelper_1 = require("../utils/RescueMathHelper");
const RescueStatus_1 = require("../enums/RescueStatus");
const findRequestByIdOrCustomId = async (id) => {
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
const getIsoString = (value) => {
    if (!value)
        return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};
const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const normalizePhotoList = (value) => {
    const photos = toArray(value).filter((photo) => typeof photo === "string" && photo.trim().length > 0);
    return photos.length ? photos : [DEFAULT_RESCUE_PHOTO];
};
const formatCaseRecord = ({ request, rescuer = null, history = null }) => {
    const requestId = String(request.rescueRequestId || request._id);
    const rescueLocation = RescueMathHelper_1.RescueMathHelper.normalizeLocation(request.rescueLocation || rescuer?.location, rescuer?.location || FALLBACK_RESCUE_LOCATION, 0);
    const reporterLocation = RescueMathHelper_1.RescueMathHelper.normalizeLocation(request.reporterLocation, rescueLocation, 0.008);
    const distanceKm = RescueMathHelper_1.RescueMathHelper.toNumber(request.distanceKm, RescueMathHelper_1.RescueMathHelper.deriveDistance(reporterLocation, rescueLocation));
    const etaMinutes = RescueMathHelper_1.RescueMathHelper.toNumber(request.etaMinutes, RescueMathHelper_1.RescueMathHelper.deriveEta(distanceKm));
    const rescuerFromModel = rescuer
        ? {
            id: String(rescuer._id),
            userId: rescuer.userId ? String(rescuer.userId) : "",
            name: rescuer.name,
            avatar: rescuer.avatar || "",
            phone: rescuer.phone || "",
            location: RescueMathHelper_1.RescueMathHelper.normalizeLocation(rescuer.location, FALLBACK_RESCUE_LOCATION, 0),
        }
        : null;
    const rescuerFromData = history || request.rescuerName
        ? {
            id: history?.rescuerId || request.rescuerId || "",
            userId: "",
            name: history?.rescuerName || request.rescuerName || "",
            avatar: history?.rescuerAvatar || request.rescuerAvatar || "",
            phone: history?.rescuerPhone || request.rescuerPhone || "",
            location: RescueMathHelper_1.RescueMathHelper.normalizeLocation(history?.rescuerLocation || request.rescueLocation, rescueLocation, 0),
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
        description: request.description || history?.description || "Pending rescue request",
        photos: photosList,
        photoUrl: photosList[0] || DEFAULT_RESCUE_PHOTO,
        createdAt: getIsoString(request.createdAt),
        updatedAt: getIsoString(request.updatedAt || request.createdAt),
        completedAt: history?.completedAt ? getIsoString(history.completedAt) : null,
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
        distanceKm,
        etaMinutes,
        summary: request.summary || history?.summary || "Pending rescue request",
    };
};
// Returns all rescuers in the database.
exports.listRescuers = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const rescuers = await Rescuer.find({});
    console.log(`[RESCUE] Found ${rescuers.length} rescuers in database`);
    res.json({ count: rescuers.length, rescuers });
});
;
// ─────────────────────────────────────────────────────────────
// POST /api/rescue/find-nearest
// ─────────────────────────────────────────────────────────────
exports.findNearestRescuer = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
    const result = await RescueService_1.RescueService.findNearestRescuer({
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
});
;
// POST /api/rescue/send-request
exports.sendRescueRequest = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { rescuerId, caseId, animalType, description, photos, reporterName, reporterAvatar, reporterLocation, rescueLocation, distanceKm, etaMinutes, summary, userId, } = req.body;
    Logger_1.Logger.info(`Sending request to rescuer ID: ${rescuerId} for user ID: ${userId || "logged-in-user"}`, { service: "RescueController" });
    if (!rescuerId) {
        res.status(400).json({ error: "rescuerId is required" });
        return;
    }
    const rescuer = await Rescuer.findById(rescuerId);
    if (!rescuer) {
        res.status(404).json({ error: "Rescuer not found" });
        return;
    }
    const payload = {
        userId: userId || req.body.reporterId || "logged-in-user",
        caseId: caseId || "",
        animalType: animalType || "Unknown animal",
        description: description || "Pending rescue request",
        photos: normalizePhotoList(photos),
        reporterName: reporterName || "Reporter",
        reporterPhone: req.body.reporterPhone || "",
        reporterAvatar: reporterAvatar || "",
        reporterLocation: reporterLocation || undefined,
        rescueLocation: rescueLocation || undefined,
        distanceKm: distanceKm ?? null,
        etaMinutes: etaMinutes ?? null,
        summary: summary || "Pending rescue request",
    };
    const request = await RescueService_1.RescueService.createRescueRequest(payload, rescuer);
    res.json({
        requestId: String(request._id),
        status: RescueStatus_1.RescueStatus.PENDING,
        rescuer: {
            _id: String(rescuer._id),
            name: rescuer.name,
            phone: rescuer.phone,
            avatar: rescuer.avatar || "",
            location: rescuer.location,
        },
    });
});
;
// PATCH /api/rescue/request/:id/cancel
exports.cancelRescueRequest = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const id = req.params.id;
    console.log(`[RESCUE] Cancel request called with id: ${id}`);
    const request = await findRequestByIdOrCustomId(id);
    if (!request) {
        console.log(`[RESCUE] Cancel: No request found for id: ${id}`);
        res.status(404).json({ error: "Request not found" });
        return;
    }
    request.status = RescueStatus_1.RescueStatus.CANCELLED;
    await request.save();
    console.log(`[RESCUE] Request ${id} cancelled by reporter (DB _id: ${request._id})`);
    res.json({ success: true, request });
});
;
exports.listPendingRescues = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const pending = await RescueRequest.find({ status: { $in: [RescueStatus_1.RescueStatus.PENDING, RescueStatus_1.RescueStatus.ACCEPTED] } })
        .sort({ createdAt: -1 })
        .populate("rescuerId");
    res.json(pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })));
});
;
exports.listCompletedRescues = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const historyEntries = await RescueHistory.find({ status: RescueStatus_1.RescueStatus.COMPLETED }).sort({ completedAt: -1, createdAt: -1 });
    res.json(historyEntries.map((history) => formatCaseRecord({ request: history, history })));
});
;
exports.listAllRescues = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const [pending, completed] = await Promise.all([
        RescueRequest.find({ status: { $in: [RescueStatus_1.RescueStatus.PENDING, RescueStatus_1.RescueStatus.ACCEPTED] } }).sort({ createdAt: -1 }).populate("rescuerId"),
        RescueHistory.find({ status: RescueStatus_1.RescueStatus.COMPLETED }).sort({ completedAt: -1, createdAt: -1 }),
    ]);
    const all = [
        ...pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })),
        ...completed.map((history) => formatCaseRecord({ request: history, history })),
    ].sort((left, right) => {
        const leftTime = new Date(left.completedAt || left.createdAt).getTime();
        const rightTime = new Date(right.completedAt || right.createdAt).getTime();
        return rightTime - leftTime;
    });
    res.json(all);
});
;
exports.listUserRescues = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = (req.params && req.params.userId) || (req.query && req.query.userId) || "logged-in-user";
    Logger_1.Logger.info(`Listing rescues for user ID: ${userId}`, { service: "RescueController" });
    const User = require("../models/User");
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
    }
    let pendingQuery = { userId, status: { $in: [RescueStatus_1.RescueStatus.PENDING, RescueStatus_1.RescueStatus.ACCEPTED] } };
    let completedQuery = { userId, status: RescueStatus_1.RescueStatus.COMPLETED };
    if (user && (user.role === "volunteer" || user.role === "ngo" || user.role === "vet" || user.role === "rescuer")) {
        const rescuer = await Rescuer.findOne({ userId: user._id });
        if (rescuer) {
            pendingQuery = { rescuerId: rescuer._id, status: { $in: [RescueStatus_1.RescueStatus.PENDING, RescueStatus_1.RescueStatus.ACCEPTED] } };
            completedQuery = { rescuerId: String(rescuer._id), status: RescueStatus_1.RescueStatus.COMPLETED };
        }
    }
    const [pending, completed] = await Promise.all([
        RescueRequest.find(pendingQuery).sort({ createdAt: -1 }).populate("rescuerId"),
        RescueHistory.find(completedQuery).sort({ completedAt: -1, createdAt: -1 }),
    ]);
    const all = [
        ...pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })),
        ...completed.map((history) => formatCaseRecord({ request: history, history })),
    ].sort((left, right) => {
        const leftTime = new Date(left.completedAt || left.createdAt).getTime();
        const rightTime = new Date(right.completedAt || right.createdAt).getTime();
        return rightTime - leftTime;
    });
    Logger_1.Logger.info(`Found ${all.length} rescues for user ID: ${userId}`, { service: "RescueController" });
    res.json(all);
});
;
exports.getRescueById = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
        }
        catch (err) {
            console.error("[RESCUE] Failed to look up rescuer for history:", err.message);
        }
        const formatted = formatCaseRecord({ request: history, history, rescuer: rescuerDoc });
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
        const formatted = formatCaseRecord({ request: pendingRequest, rescuer: pendingRequest.rescuerId || null });
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
});
;
exports.getLiveTracking = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { requestId } = req.params;
    const request = await findRequestByIdOrCustomId(String(requestId));
    if (!request) {
        res.status(404).json({ error: "Request not found" });
        return;
    }
    const formatted = formatCaseRecord({ request, rescuer: request.rescuerId || null });
    res.json({
        ...formatted,
        reporterLocation: formatted.reporter.location,
        rescuerLocation: formatted.rescuer?.location || null,
        distanceKm: formatted.distanceKm,
        etaMinutes: formatted.etaMinutes,
        lastUpdatedAt: getIsoString(request.updatedAt || request.createdAt),
    });
});
;
exports.checkRequestStatus = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { requestId } = req.params;
    Logger_1.Logger.info(`Checking status of request: ${requestId}`, { service: "RescueController" });
    const request = await findRequestByIdOrCustomId(String(requestId));
    if (!request) {
        res.status(404).json({ error: "Request not found" });
        return;
    }
    res.json({
        requestId: String(request._id),
        status: request.status,
        rescuer: request.rescuerId
            ? {
                _id: String(request.rescuerId._id),
                userId: String(request.rescuerId.userId || ""),
                name: request.rescuerId.name,
                phone: request.rescuerId.phone,
                avatar: request.rescuerId.avatar || "",
                location: request.rescuerId.location,
            }
            : null,
    });
});
;
// GET /api/rescue/active-request
exports.getActiveRescuerRequest = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const userId = req.user.id;
    // Find the Rescuer document for this user
    const rescuer = await Rescuer.findOne({ userId });
    if (!rescuer) {
        res.json({ request: null });
        return;
    }
    // Find the latest pending request for this rescuer
    const pendingRequest = await RescueRequest.findOne({
        rescuerId: rescuer._id,
        status: RescueStatus_1.RescueStatus.PENDING,
    }).sort({ createdAt: -1 });
    res.json({ request: pendingRequest });
});
;
// PATCH /api/rescue/request/:id/respond
exports.respondToRescueRequest = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
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
    request.status = action === "accept" ? "accepted" : "rejected";
    await request.save();
    console.log(`[RESCUE] Rescuer responded to request ${id} with: ${request.status}`);
    if (action === "accept") {
        // 1. Update StrayReport status to "Under Rescue"
        try {
            const StrayReport = require("../models/strayreport");
            const report = await StrayReport.findOne({ caseId: request.caseId });
            if (report) {
                report.status = "Under Rescue";
                if (!report.timeline)
                    report.timeline = [];
                report.timeline.push({
                    status: "Under Rescue",
                    message: `Case accepted by rescuer: ${request.rescuerName || "Rescuer"}`,
                    timestamp: new Date(),
                });
                await report.save();
                console.log(`[RESCUE] StrayReport ${request.caseId} updated status to 'Under Rescue'`);
            }
        }
        catch (err) {
            console.error("[RESCUE] Failed to update StrayReport status on accept:", err.message || err);
        }
        if (request.userId && mongoose.Types.ObjectId.isValid(request.userId)) {
            try {
                const rescuer = await Rescuer.findById(request.rescuerId);
                await NotificationService_1.NotificationService.sendNotification(String(request.userId), "Rescue Request Accepted", `${rescuer.name} has accepted your rescue request and is on their way!`, "success");
            }
            catch (err) {
                console.error("[RESCUE] Failed to create notification for reporter:", err.message);
            }
        }
    }
    if (action === "reject") {
        // 2. Trigger circular matching to find the next nearest rescuer
        try {
            console.log(`[RESCUE] Rejection triggered circular matching lookup for caseId: ${request.caseId}`);
            const rejections = await RescueRequest.find({ caseId: request.caseId, status: "rejected" });
            const excludeIds = rejections.map((r) => String(r.rescuerId));
            if (request.rescuerId && !excludeIds.includes(String(request.rescuerId))) {
                excludeIds.push(String(request.rescuerId));
            }
            const nextRescuerResult = await RescueService_1.RescueService.findNearestRescuer({
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
                const nextRescueRequest = await RescueService_1.RescueService.createRescueRequest(nextRequestPayload, nextRescuerResult.rescuer);
                console.log(`[RESCUE] Successfully forwarded case ${request.caseId} to next rescuer ${nextRescuerResult.rescuer.name}`);
            }
            else {
                console.log(`[RESCUE] No more available rescuers found for case ${request.caseId}. Fallback to public map.`);
                const StrayReport = require("../models/strayreport");
                const report = await StrayReport.findOne({ caseId: request.caseId });
                if (report) {
                    report.status = "Needs Help";
                    if (!report.timeline)
                        report.timeline = [];
                    report.timeline.push({
                        status: "Needs Help",
                        message: "All nearby rescuers declined. Case is now open for public rescue.",
                        timestamp: new Date(),
                    });
                    await report.save();
                    console.log(`[RESCUE] StrayReport ${request.caseId} fallback to public map (status: Needs Help)`);
                }
            }
        }
        catch (err) {
            console.error("[RESCUE] Failed to execute circular matching:", err.message || err);
        }
    }
    res.json({ success: true, request });
});
;
// PATCH /api/rescue/request/:id/details
exports.updateRescueDetails = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { id } = req.params;
    const { summary } = req.body;
    if (!summary) {
        res.status(400).json({ error: "Details/summary are required" });
        return;
    }
    let request = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
        request = await RescueRequest.findById(id);
    }
    if (!request) {
        request = await RescueRequest.findOne({ rescueRequestId: id });
    }
    if (!request) {
        request = await RescueRequest.findOne({ caseId: id }).sort({ createdAt: -1 });
    }
    let history = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
        history = await RescueHistory.findById(id);
    }
    if (!history) {
        history = await RescueHistory.findOne({ rescueRequestId: id });
    }
    if (!history) {
        history = await RescueHistory.findOne({ caseId: id });
    }
    const timestamp = new Date().toLocaleString("en-US", { hour12: true });
    const newUpdate = `[${timestamp}] ${summary}`;
    if (request) {
        if (request.rescuerId && req.user) {
            const rescuerDoc = await Rescuer.findOne({ userId: req.user.id });
            if (!rescuerDoc || String(request.rescuerId) !== String(rescuerDoc._id)) {
                res.status(403).json({ error: "Forbidden. Only the assigned rescuer can update or manage this case." });
                return;
            }
        }
        if (request.summary && request.summary !== "Pending rescue request" && request.summary !== "Completed rescue" && request.summary.trim() !== "") {
            request.summary = `${newUpdate}\n${request.summary}`;
        }
        else {
            request.summary = newUpdate;
        }
        await request.save();
        res.json({ success: true, request });
        return;
    }
    if (history) {
        if (history.rescuerId && req.user) {
            const rescuerDoc = await Rescuer.findOne({ userId: req.user.id });
            if (!rescuerDoc || String(history.rescuerId) !== String(rescuerDoc._id)) {
                res.status(403).json({ error: "Forbidden. Only the assigned rescuer can update or manage this case." });
                return;
            }
        }
        if (history.summary && history.summary !== "Pending rescue request" && history.summary !== "Completed rescue" && history.summary.trim() !== "") {
            history.summary = `${newUpdate}\n${history.summary}`;
        }
        else {
            history.summary = newUpdate;
        }
        await history.save();
        res.json({ success: true, history });
        return;
    }
    res.status(404).json({ error: "Rescue request or history not found" });
});
;
// POST /api/rescue/accept-from-map
// Allows a rescuer to directly accept a case from the public rescue map
exports.acceptFromMap = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { caseId } = req.body;
    const userId = req.user.id;
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
    const StrayReport = require("../models/strayreport");
    const report = await StrayReport.findOne({ caseId });
    if (!report) {
        res.status(404).json({ error: "Case not found" });
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
        status: RescueStatus_1.RescueStatus.ACCEPTED,
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
    if (!report.timeline)
        report.timeline = [];
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
            await NotificationService_1.NotificationService.sendNotification(String(report.reporterUserId), "Rescue Request Accepted", `${rescuer.name} has accepted your rescue case and is on their way!`, "success", String(request._id), caseId);
        }
        catch (err) {
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
    }
    catch (err) {
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
});
;
//# sourceMappingURL=rescueController.js.map