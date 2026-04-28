const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app"); // Express app with middleware
const connectDB = require("./src/config/db");
require("dotenv").config();

// 1. CONNECT TO DATABASE
connectDB();

// 2. CREATE HTTP SERVER (required for socket.io)
const server = http.createServer(app);

// 3. INITIALIZE SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (dev mode)
    methods: ["GET", "POST", "PATCH"],
  },
});

// 4. LOAD SOCKET HANDLERS
// These files contain the real-time event logic
require("./src/sockets/rescueSocket")(io);
require("./src/sockets/chatSocket")(io);

// 5. SERVE STATIC UPLOADED IMAGES
// before routes so images load correctly
app.use("/uploads", express.static("uploads"));

// 6. MOUNT API ROUTES
const uploadRoutes = require("./src/routes/uploadRoutes");
const reportRoutes = require("./src/routes/reportRoutes");

app.use("/api/upload", uploadRoutes);   // Image upload endpoints
app.use("/api/strays", reportRoutes);   // Report CRUD endpoints

// 7. START SERVER
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0"; // Expose to LAN

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// 8. ERROR HANDLING FOR SERVER STARTUP
server.on("error", (err) => {
  console.error("Server failed to start:", err.message);
});
