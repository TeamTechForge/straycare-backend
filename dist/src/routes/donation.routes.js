"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
const donationController_1 = require("../controllers/donationController");
// Initiate a donation
router.post("/initiate", authMiddleware, donationController_1.donationController.initiateDonation);
// Redirect to PayHere checkout
router.get("/pay", donationController_1.donationController.getPayCheckout);
// Save successful donation
router.post("/save", authMiddleware, donationController_1.donationController.saveDonation);
// PayHere notify callback
router.post("/notify", donationController_1.donationController.notifyPayhere);
// Get donation history (mobile app) — donor's own donations
router.get("/history", authMiddleware, donationController_1.donationController.getHistory);
// Get total donations for an organization
router.get("/total/:orgId", donationController_1.donationController.getTotalForOrg);
// Get received donations for an organization
router.get("/received/:orgId", donationController_1.donationController.getReceivedByOrg);
// Get donations received by the logged-in vet/NGO, with donor names attached
router.get("/received", authMiddleware, donationController_1.donationController.getReceivedDonations);
// Get all donations (admin dashboard)
router.get("/", authMiddleware, donationController_1.donationController.getAllDonations);
module.exports = router;
//# sourceMappingURL=donation.routes.js.map