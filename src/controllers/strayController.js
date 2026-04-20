// src/controllers/strayController.js

const StrayReport = require("../models/StrayReport");

// 1. CREATE A NEW REPORT
exports.createReport = async (req, res) => {
  try {
    const {
      caseId,
      animalType,
      breed,
      status,
      notes,
      anonymous,
      location,
      photos,
    } = req.body;

    // Basic validation (matches your schema)
    if (!caseId || !animalType || !status || !location) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Create and save report in MongoDB
    const newReport = await StrayReport.create({
      caseId,
      animalType,
      breed,
      status,
      notes,
      anonymous,
      location,
      photos,
    });

    res.status(201).json({
      message: "Report created successfully",
      data: newReport,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// 2. GET A SINGLE REPORT BY CASE ID
exports.getReportByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;

    const report = await StrayReport.findOne({ caseId });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// 3. GET ALL REPORTS (FOR MAP + ADMIN VIEW)
exports.getAllReports = async (req, res) => {
  try {
    const reports = await StrayReport.find();

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
