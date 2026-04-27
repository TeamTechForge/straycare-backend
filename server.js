const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const authMiddleware = require("./src/middleware/authMiddleware");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
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

// Auth routes (login)
const authRoutes = require("./src/routes/authRoutes");
app.use("/api/admin", authRoutes);


// Main API routes
const donationRoutes = require("./src/routes/donation.routes");
const organizationRoutes = require("./src/routes/organization.routes");
const rescueRoutes = require("./src/routes/rescues");
const userRoutes = require("./src/routes/users.routes");
const adminNotificationRoutes = require("./src/routes/adminNotifications.routes");

// Donations - auth handled inside route file
app.use("/api/donations", donationRoutes);

// Organizations - dropdown data
app.use("/api/organizations", organizationRoutes);

// Admin Notifications - announcements
app.use("/api/admin-notifications", adminNotificationRoutes);

// Protected routes
app.use("/api/users", authMiddleware, userRoutes);
app.use("/api", authMiddleware, rescueRoutes);

// Utility routes
app.get("/ping", (req, res) => res.send("pong"));

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

