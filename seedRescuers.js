require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Rescuer = require("./src/models/Rescuer");

// 5 sample rescuers near Colombo, Sri Lanka (lat/lng format matching the model)
const sampleRescuers = [
  {
    name: "Nimal Perera",
    phone: "+94-77-123-4567",
    avatar: "",
    isAvailable: true,
    location: { latitude: 6.9271, longitude: 79.8612 },
  },
  {
    name: "Kasuni Fernando",
    phone: "+94-71-234-5678",
    avatar: "",
    isAvailable: true,
    location: { latitude: 6.9147, longitude: 79.8725 },
  },
  {
    name: "Ravindu Jayasuriya",
    phone: "+94-76-345-6789",
    avatar: "",
    isAvailable: true,
    location: { latitude: 6.9069, longitude: 79.9022 },
  },
  {
    name: "Tharushi Silva",
    phone: "+94-75-456-7890",
    avatar: "",
    isAvailable: true,
    location: { latitude: 6.9446, longitude: 79.8458 },
  },
  {
    name: "Isuru Wickramasinghe",
    phone: "+94-78-567-8901",
    avatar: "",
    isAvailable: true,
    location: { latitude: 6.9561, longitude: 79.8807 },
  },
];

const seedRescuers = async () => {
  try {
    await connectDB();
    console.log("[SEED] Connected to MongoDB");

    // Clear existing rescuers first so seeding is idempotent
    await Rescuer.deleteMany({});
    console.log("[SEED] Cleared existing rescuers");

    const inserted = await Rescuer.insertMany(sampleRescuers);
    console.log(`[SEED] Inserted ${inserted.length} rescuers:`);
    inserted.forEach((r) => {
      console.log(`  - ${r.name} | ${r.phone} | lat:${r.location.latitude} lng:${r.location.longitude}`);
    });
  } catch (error) {
    console.error("[SEED] Failed to seed rescuers:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("[SEED] Done.");
  }
};

seedRescuers();
