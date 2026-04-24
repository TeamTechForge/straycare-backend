const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://straycare_db_user:StrayCare2025Db@ac-wktv8tl-shard-00-00.emptg6z.mongodb.net:27017,ac-wktv8tl-shard-00-01.emptg6z.mongodb.net:27017,ac-wktv8tl-shard-00-02.emptg6z.mongodb.net:27017/?ssl=true&replicaSet=atlas-13g1b4-shard-0&authSource=admin&appName=Cluster0");
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
