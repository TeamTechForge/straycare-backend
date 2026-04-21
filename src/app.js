// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const forumRoutes = require("./routes/forumRoutes");

const app = express();
console.log("app.js loaded");
console.log("Forum routes loaded:", forumRoutes);

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/nearby", nearbyRoutes);
app.use("/api/rescues", rescueRoutes);
app.use("/api/forum", (req, res, next) => {
  console.log("[API HIT]", req.method, req.originalUrl, "from", req.ip);
  next();
});
app.use("/api/forum", forumRoutes);

app.get("/", (req, res) => {
  res.send("Backend is working");
});


module.exports = app;
