// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const forumRoutes = require("./routes/forumRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const strayRoutes = require("./routes/strayRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { userRouter, reportRouter, adminRouter } = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/admin", adminRouter);
app.use("/api/nearby", nearbyRoutes);
app.use("/api/rescues", rescueRoutes);
app.use("/api/forum", (req, res, next) => {
  console.log("[API HIT]", req.method, req.originalUrl, "from", req.ip);
  next();
});
app.use("/api/forum", forumRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/stray", strayRoutes);

app.get("/test", (req, res) => {
  res.send("Backend test route working");
});

console.log("AUTH ROUTES LOADED");

module.exports = app;
