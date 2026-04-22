// src/app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const nearbyRoutes = require("./routes/nearbyRoutes");
const rescueRoutes = require("./routes/rescueRoutes");
const forumRoutes = require("./routes/forumRoutes");

const app = express();

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


module.exports = app;
