import mongoose from "mongoose";

interface IOrganization extends mongoose.Document {
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  image: string;
  description: string;
  createdAt: Date;
}

const OrganizationSchema = new mongoose.Schema({
  name: String,
  type: String,
  address: String,
  phone: String,
  email: String,
  image: String,
  description: String,
  createdAt: { type: Date, default: Date.now },
}, { collection: "Organizations" });

module.exports = mongoose.model<IOrganization>("Organization", OrganizationSchema);
