// This file connects our app to the MongoDB database.
// It reads the database address from the .env file (MONGO_URI).
// If the connection fails or is missing, it falls back to a local in-memory database for development.

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
import { Logger } from "../utils/Logger";
import dns from "dns";

try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // ignore
}

let mongod: InstanceType<typeof MongoMemoryServer> | null = null;

// connectDB is called once when the server starts
const connectDB = async (): Promise<void> => {
  // Read the MongoDB connection string from environment variables
  let mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    Logger.warn("âš ï¸ MONGO_URI is undefined. Falling back to in-memory MongoDB...", { service: "Database" });
    await startMemoryServer();
    return;
  }

  try {
    Logger.info(`Connecting to MongoDB at ${mongoURI}...`, { service: "Database" });
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // 5s timeout to trigger fallback quickly if offline
      socketTimeoutMS: 45000,
    });

    Logger.info("MongoDB connected", { service: "Database" });
  } catch (error: any) {
    Logger.warn(`âš ï¸ MongoDB connection to configured DB failed: ${error.message}`, { service: "Database" });
    Logger.info("Falling back to in-memory MongoDB server...", { service: "Database" });
    await startMemoryServer();
  }
};

const startMemoryServer = async (): Promise<void> => {
  try {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: "straycare"
      },
      launchTimeout: 60000
    });
    const memoryURI = mongod.getUri();
    Logger.info(`In-memory MongoDB Server started at: ${memoryURI}`, { service: "Database" });
    
    // Override the environment variable so other components (like GridFS) use the correct URI
    process.env.MONGO_URI = memoryURI;

    await mongoose.connect(memoryURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    Logger.info("Connected to in-memory MongoDB successfully!", { service: "Database" });

    try {
      const Rescuer = require("../models/Rescuer");
      const rescuerCount = await Rescuer.countDocuments();
      if (rescuerCount === 0) {
        const sampleRescuers = [
          { name: "Nimal Perera", phone: "+94-77-123-4567", isAvailable: true, location: { latitude: 6.9271, longitude: 79.8612 } },
          { name: "Kasuni Fernando", phone: "+94-71-234-5678", isAvailable: true, location: { latitude: 6.9147, longitude: 79.8725 } },
          { name: "Ravindu Jayasuriya", phone: "+94-76-345-6789", isAvailable: true, location: { latitude: 6.9069, longitude: 79.9022 } },
          { name: "Tharushi Silva", phone: "+94-75-456-7890", isAvailable: true, location: { latitude: 6.9446, longitude: 79.8458 } },
          { name: "Isuru Wickramasinghe", phone: "+94-78-567-8901", isAvailable: true, location: { latitude: 6.9561, longitude: 79.8807 } },
        ];
        await Rescuer.insertMany(sampleRescuers);
        Logger.info("Seeded sample rescuers into in-memory MongoDB", { service: "Database" });
      }
    } catch (seedErr: any) {
      Logger.warn("Auto-seed skipped:", seedErr.message);
    }
  } catch (err: any) {
    Logger.error("âŒ Failed to start in-memory MongoDB server:", err);
    process.exit(1);
  }
};

// Handle cleanup on process exit
process.on("SIGINT", async () => {
  if (mongod) {
    await mongod.stop();
    Logger.info("In-memory MongoDB Server stopped.", { service: "Database" });
  }
});

// Export so server.js can call this when starting up
module.exports = connectDB;
