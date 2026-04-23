const StrayReport = require("../models/StrayReport");

// 1. CREATE REPORT
exports.createReport = async (req, res) => {
  try {
    const newReport = await StrayReport.create(req.body);
    res.status(201).json(newReport);
  } catch (error) {
    res.status(500).json({ message: "Error creating report", error });
  }
};

// 2. GET REPORT BY CASE ID
exports.getReportByCaseId = async (req, res) => {
  try {
    const report = await StrayReport.findOne({ caseId: req.params.caseId });
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: "Error fetching report", error });
  }
};

// 3. GET ALL REPORTS
exports.getAllReports = async (req, res) => {
  try {
    const reports = await StrayReport.find({}, { status: 1, location: 1, caseId: 1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reports", error });
  }
};

// 4. UPDATE CASE STATUS
exports.updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    const updated = await StrayReport.findOneAndUpdate(
      { caseId },
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error });
  }
};
