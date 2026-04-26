const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

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
router.get("/report/:caseId", getReportByCaseId);
router.get("/reports", getAllReports);
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;
