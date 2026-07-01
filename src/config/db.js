const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error(
      "[DB] MONGO_URI is undefined. Add MONGO_URI to Backend/.env before starting the server."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
