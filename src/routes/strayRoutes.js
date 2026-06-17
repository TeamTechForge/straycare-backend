const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { upload, uploadToGridFs } = require("../config/gridfs");

const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/strayController");
const { verifyToken } = require("../middleware/authMiddleware");


// Create a new stray report
router.post("/report", verifyToken, createReport);

// ------------------ MULTER STORAGE ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // store in /uploads folder
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
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

// ------------------ EXISTING ROUTES ------------------
router.post("/report", createReport);

// One-step submission flow (multipart + photos)
router.post("/report/submit", uploadDisk.array("photos", 5), uploadToGridFs, createReport);

// Compatibility route for merged clients posting to /reports
router.post("/reports", createReport);

// Get a single report by caseId

router.get("/report/:caseId", getReportByCaseId);
router.get("/reports", getAllReports);
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;
