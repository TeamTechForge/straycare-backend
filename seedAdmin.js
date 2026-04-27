require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./src/models/Admin");

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const admin = new Admin({
    username: "superadmin",
    email: "admin@straycare.org",
    password: "SecurePassword123"
  });

  await admin.save();
  console.log("Admin seeded successfully");
  mongoose.disconnect();
}

seedAdmin();
