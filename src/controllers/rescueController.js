// src/controllers/rescueController.js
const RescueRequest = require("../models/RescueRequest");
const Rescuer = require("../models/Rescuer");
const RescueHistory = require("../models/RescueHistory");

const toId = (value) => (value ? String(value) : null);

const getRescueNamespace = (req) => {
  const io = req.app.get("io");
  return io ? io.of("/rescue") : null;
};

const emitRescueEvent = (req, request, eventName, payload = {}) => {
  const rescueNamespace = getRescueNamespace(req);
  if (!rescueNamespace || !request?._id) return;

  const requestId = String(request._id);
  const eventPayload = {
    requestId,
    status: request.status,
    rescuerId: request.rescuerId,
    ...payload,
  };

  rescueNamespace.emit(eventName, eventPayload);
  rescueNamespace.to(requestId).emit(eventName, eventPayload);
};

const getRescuersByDistance = async (coordinates) => {
  const [lng, lat] = coordinates;
  console.log("[RESCUE][QUERY] Searching rescuers near [lng, lat]:", [lng, lat], "with isAvailable: true");

  const rescuers = await Rescuer.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceMeters",
        spherical: true,
        query: { isAvailable: true },
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        name: 1,
        phone: 1,
        email: 1,
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  console.log("[RESCUE][RESULT] Found", rescuers.length, "available rescuers. Ranked by distance:", rescuers.map(r => ({ name: r.name, distance: Math.round(r.distanceMeters) + "m" })));
  return rescuers;
};

const getAssignedRescuerInfo = async (rescuerId) => {
  if (!rescuerId) return null;
  const rescuer = await Rescuer.findById(rescuerId).lean();
  if (!rescuer) return null;

  return {
    _id: String(rescuer._id),
    userId: rescuer.userId,
    name: rescuer.name,
    location: rescuer.location,
  };
};

const attachAssignedRescuer = async (requestDoc) => {
  const request = requestDoc.toObject ? requestDoc.toObject() : requestDoc;
  const assignedRescuer = await getAssignedRescuerInfo(request.rescuerId);
  return {
    ...request,
    assignedRescuer,
  };
};

const assignNextRescuerOrBroadcast = async (req, request, options = {}) => {
  const {
    rejectedRescuerId = null,
    rejectionReason = "rejected",
  } = options;

  const rejectedId = toId(rejectedRescuerId);
  const triedSet = new Set((request.triedRescuerIds || []).map(String));
  if (rejectedId) {
    console.log("[RESCUE][FALLBACK] Rejecting rescuer:", rejectedId, "reason:", rejectionReason);
    triedSet.add(rejectedId);
  }

  let rankedIds = (request.rankedRescuerIds || []).map(String);
  if (rankedIds.length === 0) {
    console.log("[RESCUE][ASSIGN] Initial assignment. Ranking rescuers by distance...");
    const rescuerRankings = await getRescuersByDistance(request.location.coordinates);
    rankedIds = rescuerRankings.map((rescuer) => toId(rescuer._id));
    request.rankedRescuerIds = rankedIds;
    console.log("[RESCUE][ASSIGN] Ranked", rankedIds.length, "rescuers");
  }

  const nextRescuerId = rankedIds.find((id) => !triedSet.has(String(id)));

  if (nextRescuerId) {
    console.log("[RESCUE][ASSIGN] Found next rescuer:", nextRescuerId);
    request.rescuerId = String(nextRescuerId);
    request.status = "assigned";
    request.broadcasted = false;
    triedSet.add(String(nextRescuerId));
    request.triedRescuerIds = Array.from(triedSet);
    request.assignmentStep = (request.assignmentStep || 0) + 1;
    await request.save();

    const assignedRescuer = await getAssignedRescuerInfo(nextRescuerId);
    console.log("[RESCUE][ASSIGN] Assigned to:", assignedRescuer?.name);

    emitRescueEvent(req, request, "rescue-assigned", {
      assignedRescuer,
      fallback: Boolean(rejectedId),
      rejectionReason,
      assignmentStep: request.assignmentStep,
    });

    return {
      mode: "assigned",
      request,
      assignedRescuer,
    };
  }

  console.log("[RESCUE][BROADCAST] No more rescuers. Broadcasting to all.");
  request.rescuerId = null;
  request.status = "broadcast";
  request.broadcasted = true;
  request.triedRescuerIds = Array.from(triedSet);
  request.assignmentStep = (request.assignmentStep || 0) + 1;
  await request.save();

  emitRescueEvent(req, request, "rescue-broadcast", {
    message: "Request sent",
    rejectionReason,
    assignmentStep: request.assignmentStep,
  });

  return {
    mode: "broadcast",
    request,
    assignedRescuer: null,
  };
};

// Create rescue request
exports.createRescueRequest = async (req, res) => {
  try {
    const {
      reporterId,
      animalDetails = {},
      location,
    } = req.body;

    console.log("[RESCUE][POST] /api/rescues from", req.ip, "reporterId:", reporterId);

    if (!reporterId) {
      return res.status(400).json({ message: "reporterId is required" });
    }

    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({ message: "location.coordinates [lng, lat] is required" });
    }

    const request = await RescueRequest.create({
      reporterId,
      rescuerId: null,
      animalDetails,
      location: {
        type: "Point",
        coordinates: location.coordinates,
      },
      status: "pending",
    });

    const assignmentResult = await assignNextRescuerOrBroadcast(req, request, {
      rejectionReason: "initial-assignment",
    });

    const hydratedRequest = await attachAssignedRescuer(assignmentResult.request);

    if (assignmentResult.mode === "broadcast") {
      return res.status(201).json({
        message: "No available rescuers nearby. Request sent",
        request: hydratedRequest,
      });
    }

    return res.status(201).json({
      message: "Rescue request created and assigned to nearest rescuer",
      request: hydratedRequest,
    });
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
    const hydratedRequests = await Promise.all(requests.map((request) => attachAssignedRescuer(request)));
    return res.json(hydratedRequests);
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

    const hydratedRequest = await attachAssignedRescuer(request);
    return res.json(hydratedRequest);
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

    request.rescuerId = toId(rescuerId);
    request.status = "accepted";
    request.broadcasted = false;
    request.triedRescuerIds = Array.from(new Set([...(request.triedRescuerIds || []).map(String), toId(rescuerId)]));
    await request.save();

    const assignedRescuer = await getAssignedRescuerInfo(request.rescuerId);

    emitRescueEvent(req, request, "rescue-assigned", {
      assignedRescuer,
      accepted: true,
      assignmentStep: request.assignmentStep,
    });

    const hydratedRequest = await attachAssignedRescuer(request);
    return res.json({ message: "Rescue accepted", request: hydratedRequest });
  } catch (err) {
    return res.status(500).json({ message: "Error accepting rescue", error: err.message });
  }
};

// Reject a rescue request + fallback
exports.rejectRescue = async (req, res) => {
  try {
    const { requestId } = req.params;
    const rescuerId = req.userId || req.body?.rescuerId || req.query?.rescuerId;
    console.log("[RESCUE][POST] /api/rescues/" + requestId + "/reject from", req.ip, "rescuerId:", rescuerId);

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const rejectedRescuerId = toId(rescuerId) || toId(request.rescuerId);

    emitRescueEvent(req, request, "rescue-rejected", {
      rejectedRescuerId,
      reason: "rejected",
    });

    const assignmentResult = await assignNextRescuerOrBroadcast(req, request, {
      rejectedRescuerId,
      rejectionReason: "rejected",
    });

    const hydratedRequest = await attachAssignedRescuer(assignmentResult.request);

    if (assignmentResult.mode === "broadcast") {
      return res.json({
        message: "All rescuers rejected or timed out. Request sent",
        request: hydratedRequest,
      });
    }

    return res.json({
      message: "Rescue rejected, reassigned to next nearest rescuer",
      request: hydratedRequest,
      fallbackRescuer: assignmentResult.assignedRescuer,
    });
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

    const allowedStatuses = ["pending", "assigned", "accepted", "rejected", "under_rescue", "completed", "broadcast", "timed_out"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status", allowedStatuses });
    }

    const request = await RescueRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (status === "timed_out") {
      const timedOutRescuerId = toId(request.rescuerId);

      emitRescueEvent(req, request, "rescue-rejected", {
        rejectedRescuerId: timedOutRescuerId,
        reason: "timed_out",
      });

      const assignmentResult = await assignNextRescuerOrBroadcast(req, request, {
        rejectedRescuerId: timedOutRescuerId,
        rejectionReason: "timed_out",
      });

      const hydratedRequest = await attachAssignedRescuer(assignmentResult.request);
      if (assignmentResult.mode === "broadcast") {
        return res.json({ message: "All rescuers timed out. Request sent", request: hydratedRequest });
      }

      return res.json({ message: "Timed out. Reassigned to next nearest rescuer", request: hydratedRequest });
    }

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

    const hydratedRequest = await attachAssignedRescuer(request);
    return res.json({ message: "Status updated", request: hydratedRequest });
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
