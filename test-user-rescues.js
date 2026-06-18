require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const RescueRequest = require("./src/models/RescueRequest");
const RescueHistory = require("./src/models/RescueHistory");

async function testUserRescues() {
  try {
    await connectDB();
    const userId = "logged-in-user";

    console.log(`\n=== Testing queries for userId: "${userId}" ===`);

    const pending = await RescueRequest.find({ userId, status: "pending" });
    console.log(`Pending requests found: ${pending.length}`);
    pending.forEach((req) => {
      console.log(`  - [${req.rescueRequestId}] Status: ${req.status}, Animal: ${req.animalType}, Desc: ${req.description.substring(0, 40)}...`);
    });

    const completed = await RescueHistory.find({ userId, status: "completed" });
    console.log(`Completed history found: ${completed.length}`);
    completed.forEach((hist) => {
      console.log(`  - [${hist.rescueRequestId}] Status: ${hist.status}, Animal: ${hist.animalType}, Desc: ${hist.description.substring(0, 40)}...`);
    });

    const total = pending.length + completed.length;
    console.log(`\nTotal user rescues: ${total}`);

    if (total > 0) {
      console.log("SUCCESS: User rescues verified in MongoDB!");
    } else {
      console.log("WARNING: No user rescues found. Make sure seeder has run successfully.");
    }
  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("Connection closed.");
  }
}

testUserRescues();
