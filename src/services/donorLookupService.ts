const User = require("../models/User");

export class DonorLookupService {
  // Add donor names without storing duplicate names in donation records.
  async attachDonorNames(donations: any[]): Promise<any[]> {
    // Fetch all required users in one database query.
    const donorIds = [...new Set(donations.map((d: any) => d.donorId).filter(Boolean))];

    const donors = await User.find({ _id: { $in: donorIds } }).select("name");

    const donorNameMap: Record<string, string> = {};
    donors.forEach((donor: any) => {
      donorNameMap[donor._id.toString()] = donor.name;
    });

    // Use Anonymous when a donation has no available donor account.
    return donations.map((d: any) => ({
      ...d.toObject(),
      donorName: d.donorId ? donorNameMap[d.donorId] || "Anonymous" : "Anonymous",
    }));
  }
}

export const donorLookupService = new DonorLookupService();
