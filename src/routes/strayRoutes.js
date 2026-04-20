// src/routes/strayRoutes.js

const express = require("express");
const router = express.Router();

// Import controller functions
const {
  createReport,
  getReportByCaseId,
  getAllReports,
} = require("../controllers/strayController");

// 1. Create a new stray report
router.post("/report", createReport);

// 2. Get a single report by caseId
router.get("/report/:caseId", getReportByCaseId);

// 3. Get all reports
router.get("/reports", getAllReports);

module.exports = router;
