const express = require("express");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (Number.isFinite(nodeMajor) && nodeMajor >= 23) {
  console.warn(
    `[ENV WARNING] Detected Node ${process.versions.node}. multer-gridfs-storage is known to be unstable on Node 23+; use Node 20 LTS.`
  );
}

if (!process.env.MONGO_URI) {
  console.error(
    "[ENV ERROR] MONGO_URI is missing before startup. Check Backend/.env and dotenv loading order."
  );
}

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

// Create HTTP server for socket.io
const server = http.createServer(app);

// Initialize socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
  }
});

// Load socket handlers
app.set("io", io);

require("./src/sockets/rescueSocket")(io);
require("./src/sockets/chatSocket")(io);

// Serve uploaded images BEFORE routes
app.use("/uploads", express.static("uploads"));

// Register global error handler for any late routes
const errorHandler = require("./src/middleware/errorHandler");
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log("MERCHANT ID:", process.env.PAYHERE_MERCHANT_ID);
  console.log("MERCHANT SECRET:", process.env.PAYHERE_MERCHANT_SECRET);
  console.log("BACKEND URL:", process.env.BACKEND_URL);
});

server.on("error", (err) => {
  console.error("Server failed to start:", err.message);
});

