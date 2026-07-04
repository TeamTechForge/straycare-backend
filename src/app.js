// This is the main Express app setup file.
// It sets up:
//   - CORS (who is allowed to talk to this server)
//   - JSON body parsing (so we can read POST request data)
//   - Logging (shows each request in the terminal)
//   - All API routes (rescue, forum, upload, stray, nearby)

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Import all route files

const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const rescuesRoutes = require("./routes/rescuesRoutes");
const forumRoutes = require("./routes/forumRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const strayReportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { userRouter, reportRouter, adminRouter } = require("./routes/userRoutes");
const donationRoutes = require("./routes/donation.routes");
const organizationRoutes = require("./routes/organization.routes");
const rescueCasesRoutes = require("./routes/rescues");
const usersManagementRoutes = require("./routes/users.routes");
const reportedUsersRoutes = require("./routes/reportedUsers.routes");
const moderationRoutes = require("./routes/moderationRoutes");
const adminNotificationsRoutes = require("./routes/adminNotifications.routes");
const adminManagementRoutes = require("./routes/adminRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// List of frontend origins that are allowed to make requests to this server.
// This prevents random websites from calling our API.
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://192.168.8.161:8081",
  "http://192.168.8.161:8082",
  "http://127.0.0.1:8082",
  "http://192.168.8.161:8081",
  "http://192.168.8.161:8082",
  "http://192.168.8.142:8081",
  "http://192.168.8.142:8082",
].filter(Boolean);

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {

      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        // Allow any device on the 192.168.x.x home/office network (LAN)
        /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin) ||
        // Allow Android emulator (its special IP that maps to your PC)
        /^https?:\/\/10\.0\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin) ||
        // Allow Docker or mobile hotspot IPs
        /^https?:\/\/172\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin) ||
        // Allow localhost in any form
        /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin);

      if (isAllowed) return callback(null, true);

      // Block anything not in the list above
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    credentials: false,
  })
);

// Parse incoming JSON request bodies (needed for POST/PATCH requests)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/admin", adminRouter);
app.use("/api/donations", donationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api", rescueCasesRoutes);
app.use("/api/users", usersManagementRoutes);
app.use("/api/admin", reportedUsersRoutes);
app.use("/api/moderation", moderationRoutes);
app.use("/api/admin-notifications", adminNotificationsRoutes);
app.use("/api/admins", adminManagementRoutes);

app.get("/ping", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "pong",
    time: new Date().toISOString(),
  });
});

app.use("/api/nearby", nearbyRoutes);   // Finding nearby rescuers on the map
app.use("/api/rescue", rescueRoutes);   // Rescue requests (find, send, status)
app.use("/api/rescues", rescuesRoutes); // Rescue history + live tracking

// Log every request to the forum API so we can debug easily
app.use("/api/forum", (req, res, next) => {
  console.log("[API HIT]", req.method, req.originalUrl, "from", req.ip);
  next();
});
app.use("/api/forum", forumRoutes);     // Discussion forum (posts, comments, likes)
app.use("/api/upload", uploadRoutes);   // File/image uploads
app.use("/api/stray", strayReportRoutes);     // Stray animal reports
app.use("/api/strays", strayReportRoutes);    // Same routes, alternate URL

// If someone calls an /api/... route that doesn't exist, return JSON (not HTML)
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "API route not found",
    path: req.originalUrl,
  });
});

// Global error handler — if any route throws an error, return JSON instead of an HTML error page
app.use((err, req, res, next) => {
  if (!req.originalUrl || !req.originalUrl.startsWith("/api")) {
    return next(err);
  }

  console.error("[API ERROR]", req.method, req.originalUrl, err);
  return res.status(500).json({ error: "Something went wrong" });
});

// Basic home route — just to confirm the server is up when you visit in a browser

app.get("/", (req, res) => {
  res.send("StrayCare Backend API Running");
});

// Export the app so server.js can use it

module.exports = app;
