import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
import type { Request, Response } from "express";
const User = require("../models/User");

export class NearbyController {
  private rescuerModel: any;

  constructor(rescuerModel: any) {
    this.rescuerModel = rescuerModel;
  }

  // Controller function to find rescuers near a given location
  public findNearbyRescuers = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { lat, lng } = req.query;

      const rescuers = await this.rescuerModel.find({
        isAvailable: true,
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [parseFloat(lng as string), parseFloat(lat as string)] },
            $maxDistance: 5000
          }
        }
      });

      // Filter out unapproved Vets and NGOs
      const rescuerUserIds = rescuers.map((r: any) => r.userId).filter(Boolean);
      const users = await User.find({ _id: { $in: rescuerUserIds } }).select("role isApproved").lean();
      
      const userMap = new Map();
      users.forEach((u: any) => userMap.set(u._id.toString(), u));

      const filteredRescuers = rescuers.filter((r: any) => {
        if (!r.userId) return true; // fallback for legacy data
        
        const u = userMap.get(r.userId.toString());
        if (!u) return false;
        
        if (["vet", "ngo"].includes(u.role)) {
          return u.isApproved === true;
        }
        
        return true;
      });

      res.json(filteredRescuers);
  });
}
