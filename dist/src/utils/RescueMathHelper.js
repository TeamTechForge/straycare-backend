"use strict";
// src/utils/rescueMathHelper.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RescueMathHelper = void 0;
class RescueMathHelper {
    static toNumber(value, fallback = null) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    static normalizeLocation(value, fallback = RescueMathHelper.FALLBACK_RESCUE_LOCATION, offset = 0) {
        if (value && typeof value === "object") {
            const latitude = RescueMathHelper.toNumber(value.latitude ?? value.lat, null);
            const longitude = RescueMathHelper.toNumber(value.longitude ?? value.lng, null);
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
    }
    static deriveDistance(from, to) {
        if (!from || !to)
            return 0;
        const { getDistance } = require("./distance");
        return Number(getDistance(from.latitude, from.longitude, to.latitude, to.longitude).toFixed(2));
    }
    static deriveEta(distanceKm) {
        return Math.max(5, Math.round(distanceKm * 6));
    }
}
exports.RescueMathHelper = RescueMathHelper;
RescueMathHelper.FALLBACK_RESCUE_LOCATION = {
    latitude: 6.9271,
    longitude: 79.8612,
    address: "Colombo, Sri Lanka",
};
//# sourceMappingURL=rescueMathHelper.js.map