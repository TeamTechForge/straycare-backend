const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");
require("dotenv").config();

connectDB();

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
require("./src/sockets/rescueSocket")(io);
require("./src/sockets/chatSocket")(io);

//  Serve uploaded images BEFORE routes
app.use("/uploads", express.static("uploads"));

//  Mount routes
const uploadRoutes = require("./src/routes/uploadRoutes");
const strayRoutes = require("./src/routes/strayRoutes");

app.use("/api/upload", uploadRoutes);
app.use("/api/strays", strayRoutes);

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server failed to start:", err.message);
});

