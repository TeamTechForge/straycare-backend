const Rescuer = require("../models/Rescuer");

import type { Request, Response } from "express";

// Controller function to find rescuers near a given location
exports.findNearbyRescuers = async (req: Request, res: Response): Promise<void> => {
  // Read latitude and longitude from the query parameters
  const { lat, lng } = req.query;

  // Search the database for rescuers whose location is within 5 km 
  // Uses MongoDBs geospatial $near query
  const rescuers = await Rescuer.find({
    location: {
      $near: {
        // The point we are searching from (user's location)
        $geometry: { type: "Point", coordinates: [lng, lat] },

        // Maximum distance allowed from the user
        $maxDistance: 5000
      }
    }
  });

  // Send the list of nearby rescuers back to the client
  res.json(rescuers);
};
