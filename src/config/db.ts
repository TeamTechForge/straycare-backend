// This file connects our app to the MongoDB database.
// It reads the database address from the .env file (MONGO_URI).
// If the connection fails or is missing, it falls back to a local in-memory database for development.

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod: InstanceType<typeof MongoMemoryServer> | null = null;

// connectDB is called once when the server starts
const connectDB = async (): Promise<void> => {
  // Read the MongoDB connection string from environment variables
  let mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.warn("[DB] ⚠️ MONGO_URI is undefined. Falling back to in-memory MongoDB...");
    await startMemoryServer();
    return;
  }

  try {
    console.log(`[DB] Connecting to MongoDB at ${mongoURI}...`);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // 5s timeout to trigger fallback quickly if offline
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB connected");
  } catch (error: any) {
    console.warn(`[DB] ⚠️ MongoDB connection to local/configured DB failed: ${error.message}`);
    
    // Fallback to memory server if the configured URI was localhost or 127.0.0.1
    if (mongoURI.includes("localhost") || mongoURI.includes("127.0.0.1")) {
      console.log("[DB] Falling back to in-memory MongoDB...");
      await startMemoryServer();
    } else {
      console.error("[DB] ❌ External database connection failed. Exiting...");
      process.exit(1);
    }
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
    console.log(`[DB] In-memory MongoDB Server started at: ${memoryURI}`);
    
    // Override the environment variable so other components (like GridFS) use the correct URI
    process.env.MONGO_URI = memoryURI;

    await mongoose.connect(memoryURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log("[DB] Connected to in-memory MongoDB successfully!");
  } catch (err: any) {
    console.error("[DB] ❌ Failed to start in-memory MongoDB server:", err.message);
    process.exit(1);
  }
};

// Handle cleanup on process exit
process.on("SIGINT", async () => {
  if (mongod) {
    await mongod.stop();
    console.log("[DB] In-memory MongoDB Server stopped.");
  }
});

// Export so server.js can call this when starting up
module.exports = connectDB;
