const express = require("express");
const router = express.Router();

const {
  createReport,
  getReportByCaseId,
  getAllReports,
  updateCaseStatus,
} = require("../controllers/strayController");
const { verifyToken } = require("../middleware/authMiddleware");

// Create a new stray report
router.post("/report", verifyToken, createReport);

// Get a single report by caseId
router.get("/report/:caseId", getReportByCaseId);

// Get all reports
router.get("/reports", getAllReports);

// Update case status
router.patch("/report/:caseId/status", updateCaseStatus);

module.exports = router;
