require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const RescueRequest = require("./src/models/RescueRequest");
const RescueHistory = require("./src/models/RescueHistory");

// ──────────────────────────────────────────────────────────────────────────────
// Real animal images from Unsplash (free, high-quality, no attribution needed
// when hotlinking via images.unsplash.com)
// ──────────────────────────────────────────────────────────────────────────────

const sampleRescues = [
  {
    rescueRequestId: "rs-1001",
    userId: "logged-in-user",
    status: "pending",
    caseId: "CASE-1001",
    animalType: "Dog",
    description: "Brown dog injured near the roadside and unable to walk properly.",
    photos: ["https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop&q=80"],
    reporterName: "Ayesha Perera",
    reporterPhone: "+94-77-200-1001",
    reporterAvatar: "",
    reporterLocation: { latitude: 6.9212, longitude: 79.8644, address: "Borella, Colombo" },
    rescueLocation: { latitude: 6.9238, longitude: 79.8689, address: "Borella Junction" },
    rescuerName: "Kasuni Fernando",
    rescuerPhone: "+94-71-234-5678",
    rescuerAvatar: "",
    distanceKm: 1.2,
    etaMinutes: 8,
    summary: "Pending rescue assignment",
  },
  {
    rescueRequestId: "rs-1002",
    status: "pending",
    caseId: "CASE-1002",
    animalType: "Cat",
    description: "Calico cat on a tree, needs careful recovery.",
    photos: ["https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&h=600&fit=crop&q=80"],
    reporterName: "Nimal Rajapaksa",
    reporterPhone: "+94-76-200-1002",
    reporterAvatar: "",
    reporterLocation: { latitude: 6.9375, longitude: 79.8572, address: "Maradana" },
    rescueLocation: { latitude: 6.9394, longitude: 79.8619, address: "Maradana Railway Area" },
    rescuerName: "Nimal Perera",
    rescuerPhone: "+94-77-123-4567",
    rescuerAvatar: "",
    distanceKm: 0.8,
    etaMinutes: 6,
    summary: "Awaiting rescue team",
  },
  {
    rescueRequestId: "rs-1003",
    status: "pending",
    caseId: "CASE-1003",
    animalType: "Puppy",
    description: "Lost puppy found near the park entrance with no collar.",
    photos: ["https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800&h=600&fit=crop&q=80"],
    reporterName: "Tharushi Silva",
    reporterPhone: "+94-75-200-1003",
    reporterAvatar: "",
    reporterLocation: { latitude: 6.9102, longitude: 79.8721, address: "Viharamahadevi Park" },
    rescueLocation: { latitude: 6.9096, longitude: 79.8682, address: "Park Entrance Gate" },
    rescuerName: "Ravindu Jayasuriya",
    rescuerPhone: "+94-76-345-6789",
    rescuerAvatar: "",
    distanceKm: 0.6,
    etaMinutes: 5,
    summary: "Pending pickup",
  },
  {
    rescueRequestId: "rs-1004",
    userId: "logged-in-user",
    status: "completed",
    caseId: "CASE-1004",
    animalType: "Dog",
    description: "Dog rescued from drainage after heavy rain.",
    photos: ["https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&h=600&fit=crop&q=80"],
    reporterName: "Kasuni Fernando",
    reporterPhone: "+94-71-111-1004",
    reporterAvatar: "",
    reporterLocation: { latitude: 6.9141, longitude: 79.8841, address: "Bambalapitiya" },
    rescueLocation: { latitude: 6.9128, longitude: 79.8813, address: "Canal Side Road" },
    rescuerName: "Tharushi Silva",
    rescuerPhone: "+94-75-456-7890",
    rescuerAvatar: "",
    distanceKm: 1.5,
    etaMinutes: 12,
    summary: "Successfully rescued and transferred to shelter",
    completedAt: new Date("2026-06-04T09:20:00.000Z"),
  },
  {
    rescueRequestId: "rs-1005",
    status: "completed",
    caseId: "CASE-1005",
    animalType: "Cat",
    description: "Adult cat treated and released after minor injury.",
    photos: ["https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800&h=600&fit=crop&q=80"],
    reporterName: "Isuru Wickramasinghe",
    reporterPhone: "+94-78-111-1005",
    reporterAvatar: "",
    reporterLocation: { latitude: 6.9561, longitude: 79.8807, address: "Nugegoda" },
    rescueLocation: { latitude: 6.9532, longitude: 79.8788, address: "Nugegoda Main Road" },
    rescuerName: "Isuru Wickramasinghe",
    rescuerPhone: "+94-78-567-8901",
    rescuerAvatar: "",
    distanceKm: 0.9,
    etaMinutes: 10,
    summary: "Completed and safe",
    completedAt: new Date("2026-06-05T14:10:00.000Z"),
  },
];

async function seedRescues() {
  try {
    await connectDB();
    await RescueRequest.deleteMany({});
    await RescueHistory.deleteMany({});

    const pending = sampleRescues.filter((item) => item.status === "pending").map((item) => ({
      rescueRequestId: item.rescueRequestId,
      userId: item.userId || "",
      caseId: item.caseId,
      status: item.status,
      animalType: item.animalType,
      description: item.description,
      photos: item.photos,
      reporterName: item.reporterName,
      reporterPhone: item.reporterPhone,
      reporterAvatar: item.reporterAvatar,
      reporterLocation: item.reporterLocation,
      rescueLocation: item.rescueLocation,
      rescuerName: item.rescuerName,
      rescuerPhone: item.rescuerPhone,
      rescuerAvatar: item.rescuerAvatar,
      distanceKm: item.distanceKm,
      etaMinutes: item.etaMinutes,
      summary: item.summary,
      createdAt: new Date(),
    }));

    const completedRequests = sampleRescues
      .filter((item) => item.status === "completed")
      .map((item) => ({
        rescueRequestId: item.rescueRequestId,
        userId: item.userId || "",
        caseId: item.caseId,
        status: item.status,
        animalType: item.animalType,
        description: item.description,
        photos: item.photos,
        reporterName: item.reporterName,
        reporterPhone: item.reporterPhone,
        reporterAvatar: item.reporterAvatar,
        reporterLocation: item.reporterLocation,
        rescueLocation: item.rescueLocation,
        rescuerName: item.rescuerName,
        rescuerPhone: item.rescuerPhone,
        rescuerAvatar: item.rescuerAvatar,
        distanceKm: item.distanceKm,
        etaMinutes: item.etaMinutes,
        summary: item.summary,
        createdAt: item.completedAt,
      }));

    const completedHistory = sampleRescues
      .filter((item) => item.status === "completed")
      .map((item) => ({
        rescueRequestId: item.rescueRequestId,
        userId: item.userId || "",
        caseId: item.caseId,
        status: "completed",
        animalType: item.animalType,
        description: item.description,
        photos: item.photos,
        reporterName: item.reporterName,
        reporterPhone: item.reporterPhone,
        reporterAvatar: item.reporterAvatar,
        reporterLocation: item.reporterLocation,
        rescuerId: "",
        rescuerName: item.rescuerName,
        rescuerPhone: item.rescuerPhone,
        rescuerAvatar: item.rescuerAvatar,
        rescuerLocation: item.rescueLocation,
        location: item.rescueLocation,
        distanceKm: item.distanceKm,
        etaMinutes: item.etaMinutes,
        summary: item.summary,
        outcome: item.summary,
        completedAt: item.completedAt,
      }));

    await RescueRequest.insertMany([...pending, ...completedRequests]);
    await RescueHistory.insertMany(completedHistory);

    console.log(`[SEED] Inserted ${sampleRescues.length} rescue cases with real animal images`);
  } catch (error) {
    console.error("[SEED] Failed to seed rescues:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

seedRescues();