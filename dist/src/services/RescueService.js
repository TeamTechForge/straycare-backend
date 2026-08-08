"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RescueService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const RescueMathHelper_1 = require("../utils/RescueMathHelper");
const Logger_1 = require("../utils/Logger");
const RescueStatus_1 = require("../enums/RescueStatus");
const Rescuer = require("../models/Rescuer");
const StrayReport = require("../models/strayreport");
class RescueService {
    /**
     * Finds the nearest available rescuer within a specified max distance (default 5km) based on coordinates, excluding specific IDs or the reporter themselves.
     */
    static async findNearestRescuer(params) {
        const { latitude, longitude, excludeIds, caseId, maxDistanceKm = 10 } = params;
        const StrayReport = require("../models/strayreport");
        let reporterUserId = params.reporterUserId || null;
        if (!reporterUserId && caseId) {
            const report = await StrayReport.findOne({ caseId });
            if (report && report.reporterUserId) {
                reporterUserId = String(report.reporterUserId);
            }
        }
        const query = { isAvailable: { $ne: false } };
        const ninIds = [];
        if (excludeIds && Array.isArray(excludeIds) && excludeIds.length > 0) {
            excludeIds.forEach((id) => {
                if (mongoose_1.default.Types.ObjectId.isValid(id)) {
                    ninIds.push(new mongoose_1.default.Types.ObjectId(id));
                }
            });
        }
        if (ninIds.length > 0) {
            query._id = { $nin: ninIds };
        }
        if (reporterUserId && mongoose_1.default.Types.ObjectId.isValid(reporterUserId)) {
            query.userId = { $ne: new mongoose_1.default.Types.ObjectId(reporterUserId) };
        }
        const rescuers = await Rescuer.find(query);
        if (!rescuers.length) {
            return null;
        }
        let nearest = null;
        let minDistance = Infinity;
        rescuers.forEach((rescuer) => {
            // Ensure reporter is never selected as rescuer for their own report
            if (reporterUserId) {
                const rescuerUserIdStr = rescuer.userId ? String(rescuer.userId) : "";
                const rescuerIdStr = rescuer._id ? String(rescuer._id) : "";
                const repIdStr = String(reporterUserId);
                if (rescuerUserIdStr === repIdStr || rescuerIdStr === repIdStr) {
                    return;
                }
            }
            const dist = RescueMathHelper_1.RescueMathHelper.deriveDistance({ latitude, longitude }, rescuer.location);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = rescuer;
            }
        });
        if (!nearest)
            return null;
        return {
            rescuer: nearest,
            distance: minDistance.toFixed(2),
        };
    }
    /**
     * Encapsulates the complex logic of creating a rescue request, dispatching notifications, and simulating auto-resolution.
     *
     * @param payload - The strict typed payload containing reporter and rescue details.
     * @param rescuer - The nearest available rescuer document assigned to this request.
     * @returns A promise resolving to the created RescueRequest document.
     */
    static async createRescueRequest(payload, rescuer) {
        const RescueRequest = require("../models/RescueRequest");
        const User = require("../models/User");
        const { NotificationService } = require("./NotificationService");
        let rescuerUser = null;
        if (rescuer.userId && mongoose_1.default.Types.ObjectId.isValid(String(rescuer.userId))) {
            rescuerUser = await User.findById(rescuer.userId).select("name phone profileImage avatar");
        }
        const rescuerName = rescuerUser?.name || rescuer.name || "Rescuer";
        const rescuerPhone = rescuerUser?.phone || rescuer.phone || "";
        const rescuerAvatar = rescuerUser?.profileImage || rescuerUser?.avatar || rescuer.avatar || "";
        const request = await RescueRequest.create({
            rescuerId: rescuer._id,
            userId: payload.userId,
            status: RescueStatus_1.RescueStatus.PENDING,
            caseId: payload.caseId || "",
            animalType: payload.animalType || "Unknown animal",
            description: payload.description || "Pending rescue request",
            photos: payload.photos || [],
            reporterName: payload.reporterName || "Reporter",
            reporterPhone: payload.reporterPhone || "",
            reporterAvatar: payload.reporterAvatar || "",
            reporterLocation: payload.reporterLocation || undefined,
            rescueLocation: payload.rescueLocation || undefined,
            distanceKm: payload.distanceKm ?? null,
            etaMinutes: payload.etaMinutes ?? null,
            summary: payload.summary || "Pending rescue request",
            rescuerName,
            rescuerPhone,
            rescuerAvatar,
        });
        Logger_1.Logger.info(`Request ${request._id} created for rescuer ${rescuerName} (caseId: ${payload.caseId})`, { service: "RescueService" });
        if (rescuer.userId) {
            await NotificationService.sendNotification(rescuer.userId, "New Rescue Request", `A new rescue request for a ${payload.animalType || "stray animal"} is near you.`, "info", String(request._id), payload.caseId || "");
            Logger_1.Logger.info(`Created notification for registered rescuer user ${rescuer.userId}`, { service: "RescueService" });
        }
        return request;
    }
}
exports.RescueService = RescueService;
//# sourceMappingURL=RescueService.js.map