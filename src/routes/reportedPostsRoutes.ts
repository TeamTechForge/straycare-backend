const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

import type { NextFunction, Request, Response } from "express";

const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admins only" });
    return;
  }
  next();
};

router.use(authMiddleware, requireAdmin);

router.get("/", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const reports = await db.collection("communityreports").aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "communityposts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: { path: "$post", preserveNullAndEmptyArrays: true } },
    ]).toArray();

    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load reported posts" });
  }
});

router.patch("/:reportId/dismiss", async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    const db = mongoose.connection.client.db("straycare");
    const result = await db.collection("communityreports").findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(reportId) },
      {
        $set: {
          status: "dismissed",
          reviewedBy: new mongoose.Types.ObjectId(req.user!.id),
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json({ message: "Report dismissed", report: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to dismiss report" });
  }
});

router.delete("/:reportId/post", async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { reportId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    const db = mongoose.connection.client.db("straycare");
    let removedPostId: any = null;

    await session.withTransaction(async () => {
      const report = await db.collection("communityreports").findOne(
        { _id: new mongoose.Types.ObjectId(reportId) },
        { session }
      );
      if (!report) throw new Error("REPORT_NOT_FOUND");

      removedPostId = report.postId;
      await db.collection("communityposts").deleteOne({ _id: report.postId }, { session });
      await db.collection("communityreports").updateMany(
        { postId: report.postId, status: "pending" },
        {
          $set: {
            status: "resolved",
            reviewedBy: new mongoose.Types.ObjectId(req.user!.id),
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session }
      );
    });

    res.json({ message: "Post removed and related reports resolved", postId: removedPostId });
  } catch (error: any) {
    if (error.message === "REPORT_NOT_FOUND") {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.status(500).json({ error: error.message || "Failed to remove post" });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
