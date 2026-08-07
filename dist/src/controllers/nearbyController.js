"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearbyController = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const User = require("../models/User");
class NearbyController {
    constructor(rescuerModel) {
        // Controller function to find rescuers near a given location
        this.findNearbyRescuers = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const { lat, lng } = req.query;
            const rescuers = await this.rescuerModel.find({
                isAvailable: true,
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                        $maxDistance: 5000
                    }
                }
            });
            // Filter out unapproved Vets and NGOs
            const rescuerUserIds = rescuers.map((r) => r.userId).filter(Boolean);
            const users = await User.find({ _id: { $in: rescuerUserIds } }).select("role isApproved").lean();
            const userMap = new Map();
            users.forEach((u) => userMap.set(u._id.toString(), u));
            const filteredRescuers = rescuers.filter((r) => {
                if (!r.userId)
                    return true; // fallback for legacy data
                const u = userMap.get(r.userId.toString());
                if (!u)
                    return false;
                if (["vet", "ngo"].includes(u.role)) {
                    return u.isApproved === true;
                }
                return true;
            });
            res.json(filteredRescuers);
        });
        this.rescuerModel = rescuerModel;
    }
}
exports.NearbyController = NearbyController;
//# sourceMappingURL=nearbyController.js.map