const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { upload: gridFsUpload, uploadToGridFs } = require("../config/gridfs");

import type { Request, Response } from "express";

const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/strayController");

// ------------------ MULTER STORAGE ------------------
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, "uploads/"); // store in /uploads folder
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const diskUpload = multer({ storage });

// ------------------ UPLOAD ROUTE ------------------
router.post("/upload", diskUpload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.json({ url: fileUrl });
});

// ------------------ EXISTING ROUTES ------------------
router.post("/report", createReport);

// One-step submission flow (multipart + photos)
router.post("/report/submit", gridFsUpload.array("photos", 5), uploadToGridFs, createReport);

// Compatibility route for merged clients posting to /reports
router.post("/reports", createReport);

// Get a single report by caseId
router.get("/report/:caseId", getReportByCaseId);
router.get("/reports", getAllReports);
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;
