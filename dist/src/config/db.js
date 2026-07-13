"use strict";
// This file connects our app to the MongoDB database.
// It reads the database address from the .env file (MONGO_URI).
// If the connection fails or is missing, it falls back to a local in-memory database for development.
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Logger_1 = require("../utils/Logger");
let mongod = null;
// connectDB is called once when the server starts
const connectDB = async () => {
    // Read the MongoDB connection string from environment variables
    let mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        Logger_1.Logger.warn("⚠️ MONGO_URI is undefined. Falling back to in-memory MongoDB...", { service: "Database" });
        await startMemoryServer();
        return;
    }
    try {
        Logger_1.Logger.info(`Connecting to MongoDB at ${mongoURI}...`, { service: "Database" });
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000, // 5s timeout to trigger fallback quickly if offline
            socketTimeoutMS: 45000,
        });
        Logger_1.Logger.info("MongoDB connected", { service: "Database" });
    }
    catch (error) {
        Logger_1.Logger.warn(`⚠️ MongoDB connection to local/configured DB failed: ${error.message}`, { service: "Database" });
        // Fallback to memory server if the configured URI was localhost or 127.0.0.1
        if (mongoURI.includes("localhost") || mongoURI.includes("127.0.0.1")) {
            Logger_1.Logger.info("Falling back to in-memory MongoDB...", { service: "Database" });
            await startMemoryServer();
        }
        else {
            Logger_1.Logger.error("❌ External database connection failed. Exiting...");
            process.exit(1);
        }
    }
};
const startMemoryServer = async () => {
    try {
        mongod = await MongoMemoryServer.create({
            instance: {
                dbName: "straycare"
            },
            launchTimeout: 60000
        });
        const memoryURI = mongod.getUri();
        Logger_1.Logger.info(`In-memory MongoDB Server started at: ${memoryURI}`, { service: "Database" });
        // Override the environment variable so other components (like GridFS) use the correct URI
        process.env.MONGO_URI = memoryURI;
        await mongoose.connect(memoryURI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        Logger_1.Logger.info("Connected to in-memory MongoDB successfully!", { service: "Database" });
    }
    catch (err) {
        Logger_1.Logger.error("❌ Failed to start in-memory MongoDB server:", err);
        process.exit(1);
    }
};
// Handle cleanup on process exit
process.on("SIGINT", async () => {
    if (mongod) {
        await mongod.stop();
        Logger_1.Logger.info("In-memory MongoDB Server stopped.", { service: "Database" });
    }
});
// Export so server.js can call this when starting up
module.exports = connectDB;
//# sourceMappingURL=db.js.map