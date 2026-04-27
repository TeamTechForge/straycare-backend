require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Rescuer = require("./src/models/Rescuer");

const sampleRescuers = [
  {
    name: "Nimal Perera",
    phone: "+94-77-123-4567",
    email: "nimal.perera.rescuer@example.com",
    role: "rescuer",
    isAvailable: true,
    location: {
      type: "Point",
      coordinates: [79.8612, 6.9271],
    },
  },
  {
    name: "Kasuni Fernando",
    phone: "+94-71-234-5678",
    email: "kasuni.fernando.rescuer@example.com",
    role: "rescuer",
    isAvailable: true,
    location: {
      type: "Point",
      coordinates: [79.8725, 6.9147],
    },
  },
  {
    name: "Ravindu Jayasuriya",
    phone: "+94-76-345-6789",
    email: "ravindu.jayasuriya.rescuer@example.com",
    role: "rescuer",
    isAvailable: true,
    location: {
      type: "Point",
      coordinates: [79.9022, 6.9069],
    },
  },
  {
    name: "Tharushi Silva",
    phone: "+94-75-456-7890",
    email: "tharushi.silva.rescuer@example.com",
    role: "rescuer",
    isAvailable: true,
    location: {
      type: "Point",
      coordinates: [79.8458, 6.9446],
    },
  },
  {
    name: "Isuru Wickramasinghe",
    phone: "+94-78-567-8901",
    email: "isuru.wickramasinghe.rescuer@example.com",
    role: "rescuer",
    isAvailable: true,
    location: {
      type: "Point",
      coordinates: [79.8807, 6.9561],
    },
  },
];

const seedRescuers = async () => {
  try {
    await connectDB();

    const emails = sampleRescuers.map((rescuer) => rescuer.email);
    const existingRescuers = await Rescuer.find(
      {
        role: "rescuer",
        email: { $in: emails },
      },
      { email: 1 }
    ).lean();

    const existingEmailSet = new Set(existingRescuers.map((rescuer) => rescuer.email));

    const rescuersToInsert = sampleRescuers.filter(
      (rescuer) => !existingEmailSet.has(rescuer.email)
    );

    if (rescuersToInsert.length === 0) {
      console.log("No new rescuers inserted. Sample rescuers already exist.");
      return;
    }

    const inserted = await Rescuer.insertMany(rescuersToInsert, { ordered: false });

    console.log(`Inserted ${inserted.length} sample rescuers.`);
    inserted.forEach((rescuer) => {
      console.log(`- ${rescuer.name} (${rescuer.email}) @ [${rescuer.location.coordinates.join(", ")}]`);
    });
  } catch (error) {
    console.error("Failed to seed rescuers:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedRescuers();
