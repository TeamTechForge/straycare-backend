const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

import type { Request, Response } from "express";

router.get("/reported-users", async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.client.db("straycare");
    const reports = await db.collection("userreports").find({}).sort({ createdAt: -1 }).toArray();
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
