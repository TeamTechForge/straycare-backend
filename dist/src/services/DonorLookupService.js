"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.donorLookupService = exports.DonorLookupService = void 0;
const User = require("../models/User");
class DonorLookupService {
    async attachDonorNames(donations) {
        const donorIds = [...new Set(donations.map((d) => d.donorId).filter(Boolean))];
        const donors = await User.find({ _id: { $in: donorIds } }).select("name");
        const donorNameMap = {};
        donors.forEach((donor) => {
            donorNameMap[donor._id.toString()] = donor.name;
        });
        return donations.map((d) => ({
            ...d.toObject(),
            donorName: d.donorId ? donorNameMap[d.donorId] || "Anonymous" : "Anonymous",
        }));
    }
}
exports.DonorLookupService = DonorLookupService;
exports.donorLookupService = new DonorLookupService();
//# sourceMappingURL=donorLookupService.js.map