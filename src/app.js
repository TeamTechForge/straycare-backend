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

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://192.168.8.161:8081",
  "http://192.168.8.161:8082",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Expo Go / native fetch often sends no Origin header.
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https?:\/\/192\.168\.[0-9]+\.[0-9]+:808[0-9]$/.test(origin);

      if (isAllowed) return callback(null, true);

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    credentials: false,
  })
);
app.use(express.json());
app.use(morgan("dev"));

<<<<<<< HEAD
// --- REGISTER ROUTES ---
=======
app.get("/ping", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "pong",
    time: new Date().toISOString(),
  });
});

>>>>>>> 0af9fd1 (Merge nearby and image uploading part)
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
