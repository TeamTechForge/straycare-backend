import { catchAsync } from "../utils/catchAsync";
import type { NextFunction } from "express";
import type { Request, Response } from "express";

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

      res.json(rescuers);
  });
}
