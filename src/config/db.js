const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://straycare_db_user:StrayCare2025Db@cluster0.emptg6z.mongodb.net/straycare?retryWrites=true&w=majority&appName=Cluster0");
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
