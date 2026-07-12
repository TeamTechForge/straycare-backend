"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const StrayReport = require("../models/strayreport");
const parseMaybeJson = (value) => {
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch (_) {
        return value;
    }
};
const normalizePhotos = (payload, files = []) => {
    const bodyPhotos = parseMaybeJson(payload.photos);
    const bodyFileIds = parseMaybeJson(payload.fileIds || payload.photoIds);
    const normalized = [];
    if (Array.isArray(bodyPhotos))
        normalized.push(...bodyPhotos);
    if (Array.isArray(bodyFileIds))
        normalized.push(...bodyFileIds);
    if (Array.isArray(files) && files.length > 0) {
        normalized.push(...files.map((file) => String(file.id)));
    }
    return [...new Set(normalized.map((id) => String(id)))];
};
const normalizeLocation = (rawLocation) => {
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
const normalizeAnonymous = (value) => {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return value.toLowerCase() === "true";
    return false;
};
const normalizeStatus = (value) => {
    const allowed = ["Needs Help", "Under Rescue", "Treated", "Ready for Adoption"];
    return allowed.includes(value) ? value : "Needs Help";
};
const buildReportPayload = (req) => {
    const payload = { ...req.body };
    payload.location = normalizeLocation(payload.location);
    payload.photos = normalizePhotos(payload, req.files);
    payload.anonymous = normalizeAnonymous(payload.anonymous);
    payload.status = normalizeStatus(payload.status);
    if (!payload.caseId) {
        payload.caseId = `CASE-${Date.now()}`;
    }
    if (req.user && req.user.id) {
        payload.reporterUserId = req.user.id;
    }
    return payload;
};
//  1. CREATE REPORT
exports.createReport = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const reportPayload = buildReportPayload(req);
    console.log("[STRAY][POST] Creating report with payload:", { caseId: reportPayload.caseId, animalType: reportPayload.animalType, location: reportPayload.location });
    if (!reportPayload.animalType) {
        console.warn("[STRAY][VALIDATION] animalType is missing");
        res.status(400).json({ message: "animalType is required" });
        return;
    }
    if (!reportPayload.location ||
        !Number.isFinite(reportPayload.location.lat) ||
        !Number.isFinite(reportPayload.location.lng)) {
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
    const newReport = await StrayReport.create(reportPayload);
    console.log("[STRAY][SUCCESS] Report created:", newReport._id);
    res.status(201).json({
        message: "Report submitted successfully",
        request: newReport,
    });
});
;
// 2. GET REPORT BY CASE ID
exports.getReportByCaseId = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const report = await StrayReport.findOne({ caseId: req.params.caseId });
    if (!report) {
        res.status(404).json({ message: "Report not found" });
        return;
    }
    res.json(report);
});
;
// 3. GET ALL REPORTS
exports.getAllReports = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const reports = await StrayReport.find({}, { status: 1, location: 1, caseId: 1, animalType: 1 });
    console.log("[STRAY][GET] Fetched all reports:", reports.length);
    res.json(reports);
});
;
// 4. UPDATE CASE STATUS
exports.updateCaseStatus = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { caseId } = req.params;
    const { status } = req.body;
    const report = await StrayReport.findOne({ caseId });
    if (!report) {
        res.status(404).json({ message: "Case not found" });
        return;
    }
    // Update main status
    report.status = status;
    // Ensure timeline exists
    if (!report.timeline) {
        report.timeline = [];
    }
    // Add new timeline entry
    report.timeline.push({
        status,
        message: `Status changed to ${status}`,
        timestamp: new Date(),
    });
    await report.save();
    res.json(report);
});
;
//# sourceMappingURL=reportController.js.map