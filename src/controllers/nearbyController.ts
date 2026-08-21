import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
import type { Request, Response } from "express";

const User = require("../models/User");

export class NearbyController {
  // Model used to get rescuer locations from the database.
  private rescuerModel: any;

  constructor(rescuerModel: any) {
    this.rescuerModel = rescuerModel;
  }

  // Find available rescuers near the user's current location.
  public findNearbyRescuers = catchAsync(
    async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {

      // Get the user's latitude and longitude from the request.
      const { lat, lng } = req.query;

      // Search for available rescuers within 5 km.
      //
      // MongoDB uses [longitude, latitude] for GeoJSON coordinates.
      // $near automatically sorts the results by distance,
      // so the closest rescuer comes first.
      const rescuers = await this.rescuerModel.find({
        isAvailable: true,

        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [
                parseFloat(lng as string),
                parseFloat(lat as string),
              ],
            },

            // Maximum search distance = 5000 metres (5 km).
            $maxDistance: 5000,
          },
        },
      });

      // Get the user IDs of the rescuers we found.
      // These IDs are used to check their roles and approval status.
      const rescuerUserIds = rescuers
        .map((r: any) => r.userId)
        .filter(Boolean);

      // Get the required user information in one database query.
      const users = await User.find({
        _id: { $in: rescuerUserIds },
      })
        .select("role isApproved")
        .lean();

      // Store users in a Map so we can quickly find
      // the User record for each rescuer.
      const userMap = new Map();

      users.forEach((u: any) => {
        userMap.set(u._id.toString(), u);
      });

      // Remove rescuers who should not be shown.
      const filteredRescuers = rescuers.filter((r: any) => {

        // Some old rescuer records may not have a userId.
        // Keep them so existing data still works.
        if (!r.userId) return true;

        const u = userMap.get(r.userId.toString());

        // If the user record doesn't exist, don't include the rescuer.
        if (!u) return false;

        // Vets and NGOs must be approved before they can
        // appear in the nearby rescuer list.
        if (["vet", "ngo"].includes(u.role)) {
          return u.isApproved === true;
        }

        // Other rescuer types don't need this approval check.
        return true;
      });

      // Send the nearby, valid rescuers back to the frontend.
      res.json(filteredRescuers);
    }
  );
}