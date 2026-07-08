// This file contains the actual logic for each rescue-related API endpoint.
// Each function is called by a route in rescueRoutes.js.

const mongoose = require("mongoose");
const Rescuer = require("../models/Rescuer");
const RescueRequest = require("../models/RescueRequest");
const RescueHistory = require("../models/RescueHistory");
const { getDistance } = require("../utils/distance");

const findRequestByIdOrCustomId = async (id) => {
  let request = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    request = await RescueRequest.findById(id).populate("rescuerId");
  }
  if (!request) {
    request = await RescueRequest.findOne({ rescueRequestId: id }).populate("rescuerId");
  }
  if (!request) {
    request = await RescueRequest.findOne({ caseId: id }).populate("rescuerId");
  }
  return request;
};

const FALLBACK_RESCUE_LOCATION = {
  latitude: 6.9271,
  longitude: 79.8612,
  address: "Colombo, Sri Lanka",
};

const DEFAULT_RESCUE_PHOTO = "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop&q=80";

const toNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLocation = (value, fallback = FALLBACK_RESCUE_LOCATION, offset = 0) => {
  if (value && typeof value === "object") {
    const latitude = toNumber(value.latitude ?? value.lat, null);
    const longitude = toNumber(value.longitude ?? value.lng, null);

    if (latitude !== null && longitude !== null) {
      return {
        lat: latitude,
        lng: longitude,
        latitude,
        longitude,
        address: value.address || "",
      };
    }
  }

  return {
    lat: fallback.latitude + offset,
    lng: fallback.longitude + offset,
    latitude: fallback.latitude + offset,
    longitude: fallback.longitude + offset,
    address: value?.address || fallback.address || "",
  };
};

const deriveDistance = (from, to) => {
  if (!from || !to) return 0;
  return Number(getDistance(from.latitude, from.longitude, to.latitude, to.longitude).toFixed(2));
};

const deriveEta = (distanceKm) => Math.max(5, Math.round(distanceKm * 6));

const getIsoString = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const normalizePhotoList = (value) => {
  const photos = toArray(value).filter((photo) => typeof photo === "string" && photo.trim().length > 0);
  return photos.length ? photos : [DEFAULT_RESCUE_PHOTO];
};

const formatCaseRecord = ({ request, rescuer = null, history = null }) => {
  const requestId = String(request.rescueRequestId || request._id);
  const rescueLocation = normalizeLocation(
    request.rescueLocation || rescuer?.location,
    rescuer?.location || FALLBACK_RESCUE_LOCATION,
    0
  );
  const reporterLocation = normalizeLocation(request.reporterLocation, rescueLocation, 0.008);
  const distanceKm = toNumber(request.distanceKm, deriveDistance(reporterLocation, rescueLocation));
  const etaMinutes = toNumber(request.etaMinutes, deriveEta(distanceKm));
  const rescuerFromModel = rescuer
    ? {
      id: String(rescuer._id),
      name: rescuer.name,
      avatar: rescuer.avatar || "",
      phone: rescuer.phone || "",
      location: normalizeLocation(rescuer.location, FALLBACK_RESCUE_LOCATION, 0),
    }
    : null;

  const rescuerFromData = history || request.rescuerName
    ? {
      id: history?.rescuerId || request.rescuerId || "",
      name: history?.rescuerName || request.rescuerName || "",
      avatar: history?.rescuerAvatar || request.rescuerAvatar || "",
      phone: history?.rescuerPhone || request.rescuerPhone || "",
      location: normalizeLocation(history?.rescuerLocation || request.rescueLocation, rescueLocation, 0),
    }
    : null;

  const photosList = normalizePhotoList(request.photos || history?.photos);

  return {
    rescueRequestId: requestId,
    caseId: request.caseId || requestId,
    status: history ? history.status : request.status,
    animalType: request.animalType || history?.animalType || "Rescue case",
    description: request.description || history?.description || "Pending rescue request",
    photos: photosList,
    photoUrl: photosList[0] || DEFAULT_RESCUE_PHOTO,
    createdAt: getIsoString(request.createdAt),
    updatedAt: getIsoString(request.updatedAt || request.createdAt),
    completedAt: history?.completedAt ? getIsoString(history.completedAt) : null,
    reporter: {
      id: request.reporterId || requestId,
      name: request.reporterName || history?.reporterName || "Reporter",
      phone: request.reporterPhone || history?.reporterPhone || "",
      avatar: request.reporterAvatar || history?.reporterAvatar || "",
      location: reporterLocation,
    },
    user: {
      name: request.reporterName || history?.reporterName || "Reporter",
      phone: request.reporterPhone || history?.reporterPhone || "",
    },
    rescuer: rescuerFromModel || rescuerFromData,
    location: rescueLocation,
    distanceKm,
    etaMinutes,
    summary: request.summary || history?.summary || "Pending rescue request",
  };
};

// Returns all rescuers in the database.
exports.listRescuers = async (req, res) => {
  try {
    const rescuers = await Rescuer.find({});
    console.log(`[RESCUE] Found ${rescuers.length} rescuers in database`);
    return res.json({ count: rescuers.length, rescuers });
  } catch (err) {
    console.error("[RESCUE][listRescuers] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/rescue/find-nearest
// Takes a latitude and longitude in the request body.
// Looks through all available rescuers and returns the closest one.
// Uses the Haversine formula to calculate distance in km.
// ─────────────────────────────────────────────────────────────
exports.findNearestRescuer = async (req, res) => {
  try {
    const { latitude, longitude, excludeIds, caseId } = req.body;
    console.log(`[RESCUE] Finding nearest rescuer to lat:${latitude} lng:${longitude}, excluding: ${excludeIds || "none"}, caseId: ${caseId || "none"}`);

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "latitude and longitude must be valid numbers" });
    }

    let reporterUserId = null;
    if (caseId) {
      const StrayReport = require("../models/strayreport");
      const report = await StrayReport.findOne({ caseId });
      if (report && report.reporterUserId) {
        reporterUserId = report.reporterUserId;
        console.log(`[RESCUE] Case reported by user: ${reporterUserId}. Exclude from rescue requests.`);
      }
    }

    const query = { isAvailable: true };

    const ninIds = [];
    if (excludeIds && Array.isArray(excludeIds) && excludeIds.length > 0) {
      excludeIds.forEach((id) => {
        if (mongoose.Types.ObjectId.isValid(id)) {
          ninIds.push(new mongoose.Types.ObjectId(id));
        }
      });
    }
    if (ninIds.length > 0) {
      query._id = { $nin: ninIds };
    }

    if (reporterUserId) {
      query.userId = { $ne: new mongoose.Types.ObjectId(reporterUserId) };
    }

    const rescuers = await Rescuer.find(query);
    console.log(`[RESCUE] ${rescuers.length} rescuers are available`);

    if (!rescuers.length) {
      return res.status(404).json({ error: "No rescuers available right now. Please try again later." });
    }

    let nearest = null;
    let minDistance = Infinity;

    rescuers.forEach((rescuer) => {
      const dist = getDistance(lat, lng, rescuer.location.latitude, rescuer.location.longitude);
      console.log(`  - ${rescuer.name}: ${dist.toFixed(3)} km away`);

      if (dist < minDistance) {
        minDistance = dist;
        nearest = rescuer;
      }
    });

    console.log(`[RESCUE] Nearest rescuer: ${nearest.name} at ${minDistance.toFixed(2)} km`);

    return res.json({
      rescuer: nearest,
      distance: minDistance.toFixed(2),
    });
  } catch (err) {
    console.error("[RESCUE][findNearestRescuer] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// POST /api/rescue/send-request
// Creates a new rescue request for a specific rescuer.
// The request starts as "pending" and later resolves into a history entry.
exports.sendRescueRequest = async (req, res) => {
  try {
    const {
      rescuerId,
      caseId,
      animalType,
      description,
      photos,
      reporterName,
      reporterAvatar,
      reporterLocation,
      rescueLocation,
      distanceKm,
      etaMinutes,
      summary,
      userId,
    } = req.body;
    console.log(`[RESCUE] Sending request to rescuer ID: ${rescuerId} for user ID: ${userId || "logged-in-user"}`);

    if (!rescuerId) {
      return res.status(400).json({ error: "rescuerId is required" });
    }

    const rescuer = await Rescuer.findById(rescuerId);
    if (!rescuer) {
      return res.status(404).json({ error: "Rescuer not found" });
    }

    const request = await RescueRequest.create({
      rescuerId,
      userId: userId || req.body.reporterId || "logged-in-user",
      status: "pending",
      caseId: caseId || "",
      animalType: animalType || "Unknown animal",
      description: description || "Pending rescue request",
      photos: normalizePhotoList(photos),
      reporterName: reporterName || "Reporter",
      reporterPhone: req.body.reporterPhone || "",
      reporterAvatar: reporterAvatar || "",
      reporterLocation: reporterLocation || undefined,
      rescueLocation: rescueLocation || undefined,
      distanceKm: distanceKm ?? null,
      etaMinutes: etaMinutes ?? null,
      summary: summary || "Pending rescue request",
      rescuerName: rescuer.name,
      rescuerPhone: rescuer.phone || "",
      rescuerAvatar: rescuer.avatar || "",
    });

    console.log(`[RESCUE] Request ${request._id} created for ${rescuer.name}`);

    const Notification = require("../models/Notification");

    if (rescuer.userId) {
      try {
        await Notification.create({
          userId: rescuer.userId,
          title: "New Rescue Request",
          message: `A new rescue request for a ${animalType || "stray animal"} is near you.`,
          type: "info",
        });
        console.log(`[RESCUE] Created notification for registered rescuer ${rescuer.userId}`);
      } catch (err) {
        console.error("[RESCUE] Failed to create notification for rescuer:", err.message);
      }
    }

    if (!rescuer.userId) {
      setTimeout(async () => {
        try {
          const accepted = Math.random() > 0.3;
          request.status = accepted ? "accepted" : "rejected";
          await request.save();

          console.log(`[RESCUE] Request ${request._id} resolved to: ${request.status}`);

          if (accepted && request.userId && mongoose.Types.ObjectId.isValid(request.userId)) {
            try {
              await Notification.create({
                userId: request.userId,
                title: "Rescue Request Accepted",
                message: `${rescuer.name} has accepted your rescue request and is on their way!`,
                type: "success",
              });
              console.log(`[RESCUE] Created success notification for reporter ${request.userId}`);
            } catch (err) {
              console.error("[RESCUE] Failed to create notification for reporter:", err.message);
            }
          }
        } catch (e) {
          console.error("[RESCUE] Auto-resolve failed:", e.message);
        }
      }, 4000);
    } else {
      console.log(`[RESCUE] Matched rescuer ${rescuer.name} is a registered user (${rescuer.userId}). Waiting for real response...`);
    }

    return res.json({
      requestId: String(request._id),
      status: "pending",
      rescuer: {
        _id: String(rescuer._id),
        name: rescuer.name,
        phone: rescuer.phone,
        avatar: rescuer.avatar || "",
        location: rescuer.location,
      },
    });
  } catch (err) {
    console.error("[RESCUE][sendRescueRequest] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.listPendingRescues = async (req, res) => {
  try {
    const pending = await RescueRequest.find({ status: { $in: ["pending", "accepted"] } })
      .sort({ createdAt: -1 })
      .populate("rescuerId");

    return res.json(pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })));
  } catch (err) {
    console.error("[RESCUE][listPendingRescues] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.listCompletedRescues = async (req, res) => {
  try {
    const historyEntries = await RescueHistory.find({ status: "completed" }).sort({ completedAt: -1, createdAt: -1 });

    return res.json(historyEntries.map((history) => formatCaseRecord({ request: history, history })));
  } catch (err) {
    console.error("[RESCUE][listCompletedRescues] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.listAllRescues = async (req, res) => {
  try {
    const [pending, completed] = await Promise.all([
      RescueRequest.find({ status: { $in: ["pending", "accepted"] } }).sort({ createdAt: -1 }).populate("rescuerId"),
      RescueHistory.find({ status: "completed" }).sort({ completedAt: -1, createdAt: -1 }),
    ]);

    const all = [
      ...pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })),
      ...completed.map((history) => formatCaseRecord({ request: history, history })),
    ].sort((left, right) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

    return res.json(all);
  } catch (err) {
    console.error("[RESCUE][listAllRescues] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.listUserRescues = async (req, res) => {
  try {
    const userId = (req.params && req.params.userId) || (req.query && req.query.userId) || "logged-in-user";
    console.log(`[RESCUE] Listing rescues for user ID: ${userId}`);

    const User = require("../models/User");
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }

    let pendingQuery = { userId, status: { $in: ["pending", "accepted"] } };
    let completedQuery = { userId, status: "completed" };

    if (user && (user.role === "volunteer" || user.role === "ngo" || user.role === "vet")) {
      const rescuer = await Rescuer.findOne({ userId: user._id });
      if (rescuer) {
        pendingQuery = { rescuerId: rescuer._id, status: { $in: ["pending", "accepted"] } };
        completedQuery = { rescuerId: String(rescuer._id), status: "completed" };
      }
    }

    const [pending, completed] = await Promise.all([
      RescueRequest.find(pendingQuery).sort({ createdAt: -1 }).populate("rescuerId"),
      RescueHistory.find(completedQuery).sort({ completedAt: -1, createdAt: -1 }),
    ]);

    const all = [
      ...pending.map((request) => formatCaseRecord({ request, rescuer: request.rescuerId || null })),
      ...completed.map((history) => formatCaseRecord({ request: history, history })),
    ].sort((left, right) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

    console.log(`[RESCUE] Found ${all.length} rescues for user ID: ${userId}`);
    return res.json(all);
  } catch (err) {
    console.error("[RESCUE][listUserRescues] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.getRescueById = async (req, res) => {
  try {
    const { id } = req.params;
    let history = await RescueHistory.findOne({ rescueRequestId: id });
    if (!history) {
      history = await RescueHistory.findOne({ caseId: id });
    }

    if (history) {
      const formatted = formatCaseRecord({ request: history, history });
      return res.json({
        ...formatted,
        reporterLocation: formatted.reporter.location,
        rescuerLocation: formatted.rescuer?.location || null,
        distanceKm: formatted.distanceKm,
        etaMinutes: formatted.etaMinutes,
        lastUpdatedAt: getIsoString(history.completedAt || history.createdAt),
      });
    }

    const pendingRequest = await findRequestByIdOrCustomId(id);

    if (pendingRequest) {
      const formatted = formatCaseRecord({ request: pendingRequest, rescuer: pendingRequest.rescuerId || null });
      return res.json({
        ...formatted,
        reporterLocation: formatted.reporter.location,
        rescuerLocation: formatted.rescuer?.location || null,
        distanceKm: formatted.distanceKm,
        etaMinutes: formatted.etaMinutes,
        lastUpdatedAt: getIsoString(pendingRequest.updatedAt || pendingRequest.createdAt),
      });
    }

    return res.status(404).json({ error: "Rescue not found" });
  } catch (err) {
    console.error("[RESCUE][getRescueById] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.getLiveTracking = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await findRequestByIdOrCustomId(requestId);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const formatted = formatCaseRecord({ request, rescuer: request.rescuerId || null });
    return res.json({
      ...formatted,
      reporterLocation: formatted.reporter.location,
      rescuerLocation: formatted.rescuer?.location || null,
      distanceKm: formatted.distanceKm,
      etaMinutes: formatted.etaMinutes,
      lastUpdatedAt: getIsoString(request.updatedAt || request.createdAt),
    });
  } catch (err) {
    console.error("[RESCUE][getLiveTracking] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/rescue/status/:requestId
// Checks the current status of a rescue request.
// The app polls this every few seconds while waiting for a response.
// Returns: "pending", "accepted", or "rejected"
// ─────────────────────────────────────────────────────────────
exports.checkRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log(`[RESCUE] Checking status of request: ${requestId}`);

    const request = await findRequestByIdOrCustomId(requestId);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    return res.json({
      requestId: String(request._id),
      status: request.status,
      rescuer: request.rescuerId
        ? {
          _id: String(request.rescuerId._id),
          name: request.rescuerId.name,
          phone: request.rescuerId.phone,
          avatar: request.rescuerId.avatar || "",
          location: request.rescuerId.location,
        }
        : null,
    });
  } catch (err) {
    console.error("[RESCUE][checkRequestStatus] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// GET /api/rescue/active-request
exports.getActiveRescuerRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    // Find the Rescuer document for this user
    const rescuer = await Rescuer.findOne({ userId });
    if (!rescuer) {
      return res.json({ request: null });
    }

    // Find the latest pending request for this rescuer
    const pendingRequest = await RescueRequest.findOne({
      rescuerId: rescuer._id,
      status: "pending",
    }).sort({ createdAt: -1 });

    return res.json({ request: pendingRequest });
  } catch (err) {
    console.error("[RESCUE] getActiveRescuerRequest error:", err.message);
    return res.status(500).json({ error: "Failed to fetch active request" });
  }
};

// PATCH /api/rescue/request/:id/respond
exports.respondToRescueRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "accept" or "reject"

    if (action !== "accept" && action !== "reject") {
      return res.status(400).json({ error: "Invalid action" });
    }

    const request = await RescueRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    request.status = action === "accept" ? "accepted" : "rejected";
    await request.save();

    console.log(`[RESCUE] Rescuer responded to request ${id} with: ${request.status}`);

    if (action === "accept" && request.userId && mongoose.Types.ObjectId.isValid(request.userId)) {
      try {
        const Notification = require("../models/Notification");
        const rescuer = await Rescuer.findById(request.rescuerId);
        await Notification.create({
          userId: request.userId,
          title: "Rescue Request Accepted",
          message: `${rescuer.name} has accepted your rescue request and is on their way!`,
          type: "success",
        });
      } catch (err) {
        console.error("[RESCUE] Failed to create notification for reporter:", err.message);
      }
    }

    return res.json({ success: true, request });
  } catch (err) {
    console.error("[RESCUE] respondToRescueRequest error:", err.message);
    return res.status(500).json({ error: "Failed to respond to request" });
  }
};

// PATCH /api/rescue/request/:id/details
// Updates the summary/tracking notes for a rescue request or completion history
exports.updateRescueDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { summary } = req.body;

    if (!summary) {
      return res.status(400).json({ error: "Details/summary are required" });
    }

    let request = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      request = await RescueRequest.findById(id);
    }
    if (!request) {
      request = await RescueRequest.findOne({ rescueRequestId: id });
    }
    if (!request) {
      request = await RescueRequest.findOne({ caseId: id });
    }

    let history = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      history = await RescueHistory.findById(id);
    }
    if (!history) {
      history = await RescueHistory.findOne({ rescueRequestId: id });
    }
    if (!history) {
      history = await RescueHistory.findOne({ caseId: id });
    }

    const timestamp = new Date().toLocaleString("en-US", { hour12: true });
    const newUpdate = `[${timestamp}] ${summary}`;

    if (request) {
      if (request.summary && request.summary !== "Pending rescue request" && request.summary !== "Completed rescue" && request.summary.trim() !== "") {
        request.summary = `${newUpdate}\n${request.summary}`;
      } else {
        request.summary = newUpdate;
      }
      await request.save();
      return res.json({ success: true, request });
    }

    if (history) {
      if (history.summary && history.summary !== "Pending rescue request" && history.summary !== "Completed rescue" && history.summary.trim() !== "") {
        history.summary = `${newUpdate}\n${history.summary}`;
      } else {
        history.summary = newUpdate;
      }
      await history.save();
      return res.json({ success: true, history });
    }

    return res.status(404).json({ error: "Rescue request or history not found" });
  } catch (err) {
    console.error("[RESCUE][updateRescueDetails] Error:", err.message);
    return res.status(500).json({ error: "Failed to update details" });
  }
};
