"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearbyController = void 0;
const catchAsync_1 = require("../utils/catchAsync");
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
            res.json(rescuers);
        });
        this.rescuerModel = rescuerModel;
    }
}
exports.NearbyController = NearbyController;
//# sourceMappingURL=nearbyController.js.map