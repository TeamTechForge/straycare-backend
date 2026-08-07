// This utility calculates the straight-line distance between two GPS points.
// It uses the Haversine formula — the standard way to calculate distance
// between two lat/lng coordinates on a sphere (the Earth).
// Returns the distance in kilometres (km).
//
// Example: getDistance(6.92, 79.87, 6.91, 79.87) → ~1.1 km

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometres

  // Convert the difference in degrees to radians (math requires radians)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;

  // Final distance calculation
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { getDistance };
