// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const forumRoutes = require("./routes/forumRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const strayRoutes = require("./routes/strayRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// --- REGISTER ROUTES ---
app.use("/api/nearby", nearbyRoutes);
app.use("/api/rescues", rescueRoutes);

// Add logging for forum API hits
app.use("/api/forum", (req, res, next) => {
  console.log("[API HIT]", req.method, req.originalUrl, "from", req.ip);
  next();
});
app.use("/api/forum", forumRoutes);

// Upload + Stray routes (your workflow)
app.use("/api/upload", uploadRoutes);
app.use("/api/stray", strayRoutes);

// Base Route
app.get("/", (req, res) => {
  res.send("StrayCare Backend API Running");
});

module.exports = app;
