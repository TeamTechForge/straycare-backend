
// Handles all routes related to creating a stray report, fetching reports, updating report status, uploading photos (local storage)
const express = require("express");
const multer = require("multer");
const path = require("path");
const { upload, uploadToGridFs } = require("../config/gridfs");

const router = express.Router();

// Import controller functions
const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/reportController");
const { verifyToken } = require("../middleware/authMiddleware");

//Multer Storage Configuration , specify the destination folder and how to name the files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files in /uploads
  },
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const uploadDisk = multer({ storage });

// ------------------ UPLOAD ROUTE ------------------
router.post("/upload", uploadDisk.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});


// Create a new stray report.Controller handles validation, saves to database, and creates an initial timeline entry.
router.post("/report", verifyToken, createReport);

// One-step submission flow (multipart + photos)
router.post("/report/submit", verifyToken, uploadDisk.array("photos", 5), uploadToGridFs, createReport);

// Compatibility route for merged clients posting to /reports
router.post("/reports", verifyToken, createReport);

// Fetch a single report by its caseId.Returns full details including photos, notes, timeline, and location.
router.get("/report/:caseId", getReportByCaseId);


// Fetch all reports.Used by the map screen to display markers.
router.get("/reports", getAllReports);

// Update the status of a report.Controller also appends a new timeline entry.
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;