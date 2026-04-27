const express = require("express");
const router = express.Router();
<<<<<<< HEAD
const multer = require("multer");
const path = require("path");
=======
const { upload, uploadToGridFs } = require("../config/gridfs");
>>>>>>> 0af9fd1 (Merge nearby and image uploading part)

const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/strayController");

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

const upload = multer({ storage });

// ------------------ UPLOAD ROUTE ------------------
router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.json({ url: fileUrl });
});

// ------------------ EXISTING ROUTES ------------------
router.post("/report", createReport);
<<<<<<< HEAD
=======

// One-step submission flow (multipart + photos)
router.post("/report/submit", upload.array("photos", 5), uploadToGridFs, createReport);

// Compatibility route for merged clients posting to /reports
router.post("/reports", createReport);

// Get a single report by caseId
>>>>>>> 0af9fd1 (Merge nearby and image uploading part)
router.get("/report/:caseId", getReportByCaseId);
router.get("/reports", getAllReports);
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;
