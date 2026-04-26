// src/controllers/rescueController.js
const RescueRequest = require("../models/RescueRequest");
const Rescuer = require("../models/Rescuer");
const RescueHistory = require("../models/RescueHistory");

// Create rescue request
exports.createRescueRequest = async (req, res) => {
  try {
    const {
      reporterId,
      rescuerId,
      animalDetails = {},
      location,
    } = req.body;

    console.log("[RESCUE][POST] /api/rescues from", req.ip, "reporterId:", reporterId, "rescuerId:", rescuerId);

    if (!reporterId) {
      return res.status(400).json({ message: "reporterId is required" });
    }

    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({ message: "location.coordinates [lng, lat] is required" });
    }

    const request = await RescueRequest.create({
      reporterId,
      rescuerId: rescuerId || null,
      animalDetails,
      location: {
        type: "Point",
        coordinates: location.coordinates,
      },
      status: "pending",
    });

    return res.status(201).json({ message: "Rescue request created", request });
  } catch (err) {
    return res.status(500).json({ message: "Error creating rescue request", error: err.message });
  }
};

// List rescue requests
exports.listRescueRequests = async (req, res) => {
  try {
    const { reporterId, rescuerId, status } = req.query;
    console.log("[RESCUE][GET] /api/rescues from", req.ip, "query:", req.query);

    const filter = {};
    if (reporterId) filter.reporterId = reporterId;
    if (rescuerId) filter.rescuerId = rescuerId;
    if (status) filter.status = status;

    const requests = await RescueRequest.find(filter).sort({ _id: -1 });
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching rescue requests", error: err.message });
  }
};

// Get one rescue request
exports.getRescueRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log("[RESCUE][GET] /api/rescues/" + requestId, "from", req.ip);

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching rescue request", error: err.message });
  }
};

// Accept a rescue request
exports.acceptRescue = async (req, res) => {
  try {
    const { requestId } = req.params;
    const rescuerId = req.userId || req.body?.rescuerId || req.query?.rescuerId;
    console.log("[RESCUE][POST] /api/rescues/" + requestId + "/accept from", req.ip, "rescuerId:", rescuerId);

    if (!rescuerId) {
      return res.status(400).json({ message: "rescuerId is required" });
    }

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.rescuerId = rescuerId;
    request.status = "accepted";
    await request.save();

    return res.json({ message: "Rescue accepted", request });
  } catch (err) {
    return res.status(500).json({ message: "Error accepting rescue", error: err.message });
  }
};

// Reject a rescue request + fallback
exports.rejectRescue = async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log("[RESCUE][POST] /api/rescues/" + requestId + "/reject from", req.ip);

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = "rejected";
    await request.save();

    // Simple fallback: find another available rescuer near the same location
    const [lng, lat] = request.location.coordinates;

    const fallbackRescuer = await Rescuer.findOne({
      available: true,
      _id: { $ne: request.rescuerId },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 5000
        }
      }
    });

    if (fallbackRescuer) {
      request.rescuerId = fallbackRescuer._id;
      request.status = "pending";
      await request.save();
      return res.json({
        message: "Rescue rejected, reassigned to another rescuer",
        request,
        fallbackRescuer
      });
    }

    return res.json({ message: "Rescue rejected, no fallback rescuer found", request });
  } catch (err) {
    return res.status(500).json({ message: "Error rejecting rescue", error: err.message });
  }
};

// Update rescue status (e.g., under_rescue, completed)
exports.updateRescueStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    console.log("[RESCUE][PATCH] /api/rescues/" + requestId + "/status from", req.ip, "status:", status);

    const allowedStatuses = ["pending", "accepted", "rejected", "under_rescue", "completed"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status", allowedStatuses });
    }

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = status;
    await request.save();

    // If completed, move to history
    if (status === "completed") {
      await RescueHistory.create({
        rescueId: request._id,
        rescuerId: request.rescuerId,
        reporterId: request.reporterId,
        outcome: "Rescue completed"
      });
    }

    return res.json({ message: "Status updated", request });
  } catch (err) {
    return res.status(500).json({ message: "Error updating status", error: err.message });
  }
};

// Get rescue history for a user or rescuer
exports.getRescueHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("[RESCUE][GET] /api/rescues/history/" + userId, "from", req.ip);

    const history = await RescueHistory.find({
      $or: [{ rescuerId: userId }, { reporterId: userId }]
    });

    return res.json(history);
  } catch (err) {
    return res.status(500).json({ message: "Error fetching history", error: err.message });
  }
};
