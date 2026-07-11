const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

import type { Request, Response } from "express";

router.get("/rescue-cases", async (req: Request, res: Response) => {
  try {
   const db = mongoose.connection.client.db("straycare");
   const rescues = await db.collection("rescuerequests").find({}).sort({ createdAt: -1 }).toArray();
    res.json(rescues);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
