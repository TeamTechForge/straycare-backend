// src/utils/rescueMathHelper.ts

export class RescueMathHelper {
  private static readonly FALLBACK_RESCUE_LOCATION = {
    latitude: 6.9271,
    longitude: 79.8612,
    address: "Colombo, Sri Lanka",
  };

  public static toNumber(value: any, fallback: number | null = null): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  public static normalizeLocation(value: any, fallback: any = RescueMathHelper.FALLBACK_RESCUE_LOCATION, offset: number = 0): any {
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

  public static deriveDistance(from: any, to: any): number {
    if (!from || !to) return 0;
    const { getDistance } = require("./distance");
    return Number(getDistance(from.latitude, from.longitude, to.latitude, to.longitude).toFixed(2));
  }

  public static deriveEta(distanceKm: number): number {
    return Math.max(5, Math.round(distanceKm * 6));
  }
}
