const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Import route modules
const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const forumRoutes = require("./routes/forumRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const reportRoutes = require("./routes/reportRoutes"); 

const app = express();

// 1. GLOBAL MIDDLEWARE
app.use(cors());               // Allow cross-origin requests (mobile → backend)
app.use(express.json());       // Parse incoming JSON bodies
app.use(morgan("dev"));        // Log all requests in dev-friendly format

// 2. REGISTER ROUTEs
// Nearby animal detection routes
app.use("/api/nearby", nearbyRoutes);

// Rescue team routes
app.use("/api/rescues", rescueRoutes);

// Forum routes with custom logging middleware
app.use("/api/forum", (req, res, next) => {
  console.log("[API HIT]", req.method, req.originalUrl, "from", req.ip);
  next();
});
app.use("/api/forum", forumRoutes);

// Upload routes (image uploads)
app.use("/api/upload", uploadRoutes);

// Stray reporting workflow routes
app.use("/api/stray", reportRoutes);


// 3. BASE ROUTE (HEALTH CHECK)
app.get("/", (req, res) => {
  res.send("StrayCare Backend API Running");
});


// 4. EXPORT APP FOR SERVER.JS
module.exports = app;
