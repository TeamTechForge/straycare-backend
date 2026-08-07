"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const NGOProfile = require("../models/NGOProfile");
const VetProfile = require("../models/VetProfile");
const search = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { q } = req.query;
    if (!q || !q.trim()) {
        res.json([]);
        return;
    }
    const queryTerms = q.trim().split(/\s+/).filter((t) => t.length > 0);
    if (queryTerms.length === 0) {
        res.json([]);
        return;
    }
    // Build matching criteria for NGOProfile
    const ngoMatchRules = queryTerms.map((term) => {
        const regex = new RegExp(term, "i");
        return {
            $or: [
                { orgName: regex },
                { location: regex },
                { bio: regex },
                { "user.name": regex }
            ]
        };
    });
    // Build matching criteria for VetProfile
    const vetMatchRules = queryTerms.map((term) => {
        const regex = new RegExp(term, "i");
        return {
            $or: [
                { clinicName: regex },
                { clinicAddress: regex },
                { primaryLocation: regex },
                { bio: regex },
                { specialization: regex },
                { vetFullName: regex }
            ]
        };
    });
    // Run NGO aggregation
    const ngoResults = await NGOProfile.aggregate([
        { $match: { status: "Verified", accountStatus: { $ne: "Suspended" } } },
        {
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: "$user" },
        { $match: { $and: ngoMatchRules } },
        {
            $project: {
                _id: 0,
                userId: "$user._id",
                profileId: "$_id",
                name: "$orgName",
                type: {
                    $cond: {
                        if: { $regexMatch: { input: "$orgName", regex: "shelter", options: "i" } },
                        then: "Animal Shelter",
                        else: "NGO"
                    }
                },
                profileImage: { $ifNull: ["$profileImage", ""] },
                location: "$location",
                bio: { $ifNull: ["$bio", ""] }
            }
        }
    ]);
    // Run Vet aggregation
    const vetResults = await VetProfile.aggregate([
        { $match: { status: "Verified", accountStatus: { $ne: "Suspended" } } },
        {
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: "$user" },
        {
            $addFields: {
                vetFullName: { $concat: ["Dr. ", "$user.name"] }
            }
        },
        { $match: { $and: vetMatchRules } },
        {
            $project: {
                _id: 0,
                userId: "$user._id",
                profileId: "$_id",
                name: "$vetFullName",
                clinicName: "$clinicName",
                type: { $literal: "Veterinarian" },
                profileImage: { $ifNull: ["$profileImage", ""] },
                location: "$primaryLocation",
                bio: { $ifNull: ["$bio", ""] }
            }
        }
    ]);
    // Combine results
    const combinedResults = [...ngoResults, ...vetResults];
    // Rank relevance
    const lowerQuery = q.toLowerCase().trim();
    combinedResults.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStart = aName.startsWith(lowerQuery) ? 1 : 0;
        const bStart = bName.startsWith(lowerQuery) ? 1 : 0;
        if (aStart !== bStart)
            return bStart - aStart;
        const aInclude = aName.includes(lowerQuery) ? 1 : 0;
        const bInclude = bName.includes(lowerQuery) ? 1 : 0;
        if (aInclude !== bInclude)
            return bInclude - aInclude;
        return a.name.localeCompare(b.name);
    });
    res.json(combinedResults);
});
module.exports = { search };
//# sourceMappingURL=searchController.js.map