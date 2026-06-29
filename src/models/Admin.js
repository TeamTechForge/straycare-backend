const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, default: "admin" },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  invitationToken: { type: String, default: null },
  status: { type: String, enum: ["pending", "active"], default: null },
});

AdminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model("Admin", AdminSchema, "admins");
