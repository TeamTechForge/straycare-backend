import mongoose from "mongoose";
const bcrypt = require("bcrypt");

interface IAdmin extends mongoose.Document {
  username: string;
  email: string;
  password?: string;
  role: string;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  invitationToken?: string | null;
  status?: "pending" | "active" | null;
}

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

AdminSchema.pre("save", async function (this: IAdmin) {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model<IAdmin>("Admin", AdminSchema, "admins");
