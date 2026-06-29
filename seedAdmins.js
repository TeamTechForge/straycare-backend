// seedAdmins.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("./src/models/Admin"); // adjust path if needed
require("dotenv").config();

async function seedAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const admins = [
      { username: "Thenuri", email: "thenuriwelagedara12@gmail.com", password: "Thenuri_3612" },
      { username: "Sandevi", email: "san20020803@gmail.com", password: "Sandevi123" },
      { username: "Yenuli", email: "yenulimunasinghe04@gmail.com", password: "Yenuli123" },
      { username: "Amasha", email: "amiyurangi@gmail.com", password: "Amasha123" },
      { username: "Chathumi", email: "chathubino@gmail.com", password: "Chathumi123" }
    ];

    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      await Admin.updateOne(
        { email: admin.email },              // find by email
        { ...admin, password: hashedPassword }, // update with hashed password
        { upsert: true }                     // insert if not exists
      );
    }

    console.log("All 5 admins seeded successfully!");
    mongoose.disconnect();
  } catch (err) {
    console.error("Seeding error:", err);
    mongoose.disconnect();
  }
}

seedAdmins();

