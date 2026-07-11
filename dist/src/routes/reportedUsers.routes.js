"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
router.get("/reported-users", async (req, res) => {
    try {
        const db = mongoose.connection.client.db("straycare");
        const reports = await db.collection("userreports").find({}).sort({ createdAt: -1 }).toArray();
        res.json(reports);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;
//# sourceMappingURL=reportedUsers.routes.js.map