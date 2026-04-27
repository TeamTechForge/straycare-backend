const StrayReport = require("../models/strayreport");

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const normalizePhotos = (payload, files = []) => {
  const bodyPhotos = parseMaybeJson(payload.photos);
  const bodyFileIds = parseMaybeJson(payload.fileIds || payload.photoIds);

  const normalized = [];

  if (Array.isArray(bodyPhotos)) normalized.push(...bodyPhotos);
  if (Array.isArray(bodyFileIds)) normalized.push(...bodyFileIds);
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
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
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

  return payload;
};

// 1. CREATE REPORT

exports.createReport = async (req, res) => {
  try {
    console.log("📥 Incoming Report Data:", req.body); // ⭐ DEBUG LOG

    const newReport = await StrayReport.create(req.body);
    res.status(201).json(newReport);
  } catch (error) {
    res.status(500).json({ message: "Error creating report", error });
  }
};

exports.createReport = async (req, res) => {
  try {
    const reportPayload = buildReportPayload(req);
    console.log("[STRAY][POST] Creating report with payload:", { caseId: reportPayload.caseId, animalType: reportPayload.animalType, location: reportPayload.location });

    if (!reportPayload.animalType) {
      console.warn("[STRAY][VALIDATION] animalType is missing");
      return res.status(400).json({ message: "animalType is required" });
    }

    if (
      !reportPayload.location ||
      !Number.isFinite(reportPayload.location.lat) ||
      !Number.isFinite(reportPayload.location.lng)
    ) {
      console.warn("[STRAY][VALIDATION] location is invalid:", reportPayload.location);
      return res.status(400).json({ message: "location with lat/lng is required" });
    }

    const newReport = await StrayReport.create(reportPayload);
    console.log("[STRAY][SUCCESS] Report created:", newReport._id);
    return res.status(201).json({
      message: "Report submitted successfully",
      request: newReport,
    });
  } catch (error) {
    const errorMessage = error?.message || String(error);
    const isDuplicateKey = error?.code === 11000;
    const isValidationError = error?.name === "ValidationError";
    const statusCode = isDuplicateKey ? 409 : isValidationError ? 400 : 500;
    const message = isDuplicateKey
      ? "Case ID already exists"
      : isValidationError
      ? "Invalid report payload"
      : "Error creating report";
    
    console.error("[STRAY][ERROR] Failed to create report:", errorMessage);
    return res.status(statusCode).json({ message, error: errorMessage });
  }
};

// 2. GET REPORT BY CASE ID
exports.getReportByCaseId = async (req, res) => {
  try {
    const report = await StrayReport.findOne({ caseId: req.params.caseId });
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("[STRAY][ERROR] Failed to fetch report:", errorMessage);
    res.status(500).json({ message: "Error fetching report", error: errorMessage });
  }
};

// 3. GET ALL REPORTS
exports.getAllReports = async (req, res) => {
  try {
    const reports = await StrayReport.find(
      {},
      { status: 1, location: 1, caseId: 1 }
    );
    res.json(reports);
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("[STRAY][ERROR] Failed to fetch all reports:", errorMessage);
    res.status(500).json({ message: "Error fetching reports", error: errorMessage });
  }
};

// 4. UPDATE CASE STATUS + PUSH HISTORY
exports.updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    const report = await StrayReport.findOne({ caseId });
    if (!report) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Update status
    report.status = status;

    // ⭐ Add history entry
    report.history.push({
      status,
      message: `Status changed to ${status}`,
      timestamp: new Date(),
    });

    await report.save();

    res.json(report);
  } catch (error) {
    const errorMessage = error?.message || String(error);
    console.error("[STRAY][ERROR] Failed to update status:", errorMessage);
    res.status(500).json({ message: "Error updating status", error: errorMessage });
  }
};
