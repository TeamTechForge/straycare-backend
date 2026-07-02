// This file connects our app to the MongoDB database.
// It reads the database address from the .env file (MONGO_URI).
// If the address is missing or connection fails, it stops the server immediately.

const mongoose = require("mongoose");

// connectDB is called once when the server starts
const connectDB = async () => {
  // Read the MongoDB connection string from environment variables
  const mongoURI = process.env.MONGO_URI;

  // If MONGO_URI is not set in .env,  can't connect  stop the server
  if (!mongoURI) {
    console.error(
      "[DB] MONGO_URI is undefined. Add MONGO_URI to Backend/.env before starting the server."
    );
    process.exit(1); // stop the app
  }

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB connected");
  } catch (error) {
    // If connection fails, stop the server
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Export so server.js can call this when starting up
module.exports = connectDB;
