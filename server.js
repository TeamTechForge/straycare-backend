const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const authMiddleware = require("./src/middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

// PayHere callbacks
app.get("/payhere/return", (req, res) => {
  const { status } = req.query;
  if (status === "2") {
    return res.send("<html><body><h1>status=2</h1></body></html>");
  }
  return res.send("<html><body><h1>status=0</h1></body></html>");
});

app.get("/payhere/cancel", (req, res) => {
  return res.send("<html><body><h1>cancelled</h1></body></html>");
});

app.post("/payhere/notify", async (req, res) => {
  console.log("PAYHERE NOTIFY:", req.body);
  res.sendStatus(200);
});

// Auth routes
const authRoutes = require("./src/routes/authRoutes");
app.use("/api/admin", authRoutes);

// Main API routes
const donationRoutes = require("./src/routes/donation.routes");
const organizationRoutes = require("./src/routes/organization.routes");
const rescueRoutes = require("./src/routes/rescues");
const userRoutes = require("./src/routes/users.routes");
const adminNotificationRoutes = require("./src/routes/adminNotifications.routes");
const adminManagementRoutes = require("./src/routes/adminRoutes");

app.use("/api/donations", donationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/admin-notifications", adminNotificationRoutes);
app.use("/api/admins", adminManagementRoutes);
app.use("/api/users", authMiddleware, userRoutes);
app.use("/api", authMiddleware, rescueRoutes);

// Utility
app.get("/ping", (req, res) => res.send("pong"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("MERCHANT ID:", process.env.PAYHERE_MERCHANT_ID);
  console.log("MERCHANT SECRET:", process.env.PAYHERE_MERCHANT_SECRET);
  console.log("BACKEND URL:", process.env.BACKEND_URL);
});
