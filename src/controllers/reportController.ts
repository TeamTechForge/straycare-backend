import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
const StrayReport = require("../models/strayreport");

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

  if (!payload.caseId) {
    payload.caseId = `CASE-${Date.now()}`;
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

    const newReport = await StrayReport.create(reportPayload);
    console.log("[STRAY][SUCCESS] Report created:", newReport._id);
    res.status(201).json({
      message: "Report submitted successfully",
      request: newReport,
    });
  });;

// 2. GET REPORT BY CASE ID
exports.getReportByCaseId = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const report = await StrayReport.findOne({ caseId: req.params.caseId });

    if (!report) {
      res.status(404).json({ message: "Report not found" });
      return;
    }

    res.json(report);
  });;

// 3. GET ALL REPORTS
exports.getAllReports = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const reports = await StrayReport.find(
      {},
      { status: 1, location: 1, caseId: 1, animalType: 1 }
    );
    console.log("[STRAY][GET] Fetched all reports:", reports.length);
    res.json(reports);
  });;

// 4. UPDATE CASE STATUS
exports.updateCaseStatus = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  });;
