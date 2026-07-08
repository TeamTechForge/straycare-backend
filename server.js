// ──────────────────────────────────────────────────────────────────────────────
// server.js — Backend entry point
//
// Startup order (strictly sequential — one step must succeed before the next):
//   1. Check Node version compatibility
//   2. Validate required environment variables
//   3. Find a free port (or use the one in .env)
//   4. Connect to MongoDB
//   5. Start HTTP server + Socket.IO
//   6. Print all mounted routes so we can see exactly what loaded
// ──────────────────────────────────────────────────────────────────────────────

"use strict";

const express = require("express");

// Load .env variables before anything else
require("dotenv").config();

const http   = require("http");
const net    = require("net");        // used to check if a port is free
const { Server } = require("socket.io");

const app       = require("./src/app");

const connectDB = require("./src/config/db");

// ─── 1. Node version check ────────────────────────────────────────────────────
// multer-gridfs-storage is broken on Node 23+. Recommend Node 20 LTS.
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 23) {
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.warn(`⚠️  NODE VERSION WARNING`);
  console.warn(`   You are running Node ${process.versions.node}.`);
  console.warn(`   multer-gridfs-storage is known to crash on Node 23+.`);
  console.warn(`   Please switch to Node 20 LTS: https://nodejs.org/en/download`);
  console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// ─── 2. Environment variable check ───────────────────────────────────────────
if (!process.env.MONGO_URI) {
  console.warn("[STARTUP] ⚠️  MONGO_URI is not set in Backend/.env — will fall back to in-memory MongoDB.");
}

// ─── 3. Port helper functions ─────────────────────────────────────────────────

/**
 * Check if a given port is currently free.
 * Returns true if nobody is using it, false if something is already there.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false)); // port is in use
    tester.once("listening", () => {
      tester.close(() => resolve(true)); // port is free
    });
    tester.listen(port, "0.0.0.0");
  });
}

/**
 * Starting from `startPort`, find the first port that is free.
 * Tries up to 10 ports before giving up.
 */
async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 10; port++) {
    if (await isPortFree(port)) return port;
    console.warn(`[STARTUP] ⚠️  Port ${port} is in use, trying ${port + 1}...`);
  }
  throw new Error(`No free port found in range ${startPort}–${startPort + 9}`);
}

// ─── 4. Main startup function ─────────────────────────────────────────────────
// Everything runs in order. If any step fails, the server stops cleanly.

async function startup() {
  const preferredPort = Number(process.env.PORT) || 5000;
  const HOST          = process.env.HOST || "0.0.0.0";

  // Find a free port (prefers 5000, tries 5001, 5002... if taken)
  let PORT;
  try {
    PORT = await findFreePort(preferredPort);
    if (PORT !== preferredPort) {
      console.warn(`[STARTUP] ⚠️  Port ${preferredPort} was busy — using port ${PORT} instead.`);
      console.warn(`[STARTUP]    Update EXPO_PUBLIC_API_URL in frontend-mobile/.env if this changes.`);
    }
  } catch (portErr) {
    console.error("[STARTUP] ❌ Could not find a free port:", portErr.message);
    console.error("[STARTUP]    Run this to free port 5000:");
    console.error("             npm run kill-port");
    process.exit(1);
  }

  // Connect to MongoDB FIRST — don't start the server if DB is down
  console.log("[STARTUP] Connecting to MongoDB...");
  try {
    await connectDB();
  } catch (dbErr) {
    console.error("[STARTUP] ❌ MongoDB connection failed — server will not start.");
    console.error("           Error:", dbErr.message);
    process.exit(1);
  }

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

  // Wrap the Express app in an HTTP server so Socket.IO can attach
  const server = http.createServer(app);

  // Set up Socket.IO for real-time events (rescue status, chat)
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH"],
    },
  });

  // Make io available to any route handler via req.app.get("io")
  app.set("io", io);

  // Load real-time event handlers
  require("./src/sockets/rescueSocket")(io);
  require("./src/sockets/chatSocket")(io);

  // Serve uploaded files as static assets
  // e.g. GET http://localhost:5000/uploads/photo.jpg
  app.use("/uploads", express.static("uploads"));

  // Start listening — wrapped in a Promise so errors are caught cleanly
  await new Promise((resolve, reject) => {
    server.listen(PORT, HOST, resolve);
    server.once("error", reject);
  });

  // ─── 5. Startup complete — print summary ────────────────────────────────────
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log(`║  ✅ Server running on http://${HOST}:${PORT}  `);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Routes mounted:                                 ║");
  console.log("║   GET  /ping                  → health check     ║");
  console.log("║   *    /api/nearby            → nearby rescuers  ║");
  console.log("║   *    /api/rescue            → rescue requests  ║");
  console.log("║   *    /api/forum             → discussion forum ║");
  console.log("║   *    /api/upload            → file uploads     ║");
  console.log("║   *    /api/stray             → stray reports    ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  // Graceful shutdown on Ctrl+C so the port is freed cleanly
  process.on("SIGINT", () => {
    console.log("\n[SHUTDOWN] Ctrl+C received — shutting down cleanly...");
    server.close(() => {
      console.log("[SHUTDOWN] HTTP server closed. Goodbye!");
      process.exit(0);
    });
  });
}

// Run the startup function, catch any unexpected error
startup().catch((err) => {
  console.error("[STARTUP] ❌ Unexpected startup failure:", err.message);
  process.exit(1);

});
