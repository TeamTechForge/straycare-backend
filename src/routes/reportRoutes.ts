
// Handles all routes related to creating a stray report, fetching reports, updating report status, uploading photos (local storage)
const express = require("express");
const { upload } = require("../config/gridfs");

import type { Request, Response, NextFunction } from "express";

const router = express.Router();

// Import controller functions
const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/reportController");
const { verifyToken } = require("../middleware/authMiddleware");

const { uploadFileToCloudinary } = require("../utils/cloudinaryUpload");

// ------------------ UPLOAD ROUTE ------------------
router.post("/upload", upload.single("image"), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  try {
    const url = await uploadFileToCloudinary(req.file);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});


// Create a new stray report.Controller handles validation, saves to database, and creates an initial timeline entry.
router.post("/report", verifyToken, createReport);

// One-step submission flow (multipart + photos)
router.post(
  "/report/submit",
  verifyToken,
  upload.array("photos", 5),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        const uploadPromises = (req.files as Express.Multer.File[]).map((file: Express.Multer.File) => uploadFileToCloudinary(file));
        const urls = await Promise.all(uploadPromises);
        req.body.photos = JSON.stringify(urls);
      }
      next();
    } catch (error: any) {
      res.status(500).json({ message: "Failed to upload photos", error: error.message });
    }
  },
  createReport
);

// Compatibility route for merged clients posting to /reports
router.post("/reports", verifyToken, createReport);

// Fetch a single report by its caseId.Returns full details including photos, notes, timeline, and location.
router.get("/report/:caseId", getReportByCaseId);


// Fetch all reports.Used by the map screen to display markers.
router.get("/reports", getAllReports);

// Update the status of a report.Controller also appends a new timeline entry.
// 🔒 Requires authentication - only rescuers can update
router.patch("/report/:caseId/status", verifyToken, updateCaseStatus);

module.exports = router;
