const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
const requireAdmin = require("../middleware/requireAdmin");

import { donationController } from "../controllers/donationController";
import type { Request, Response } from "express";

// Initiate a donation
router.post("/initiate", authMiddleware, donationController.initiateDonation);

// Redirect to PayHere checkout
router.get("/pay", donationController.getPayCheckout);

// Save successful donation
router.post("/save", authMiddleware, donationController.saveDonation);

// PayHere notify callback
router.post("/notify", donationController.notifyPayhere);

// Check a recurring donation after returning from PayHere. Ownership is enforced.
router.get("/recurring/:orderId/status", authMiddleware, donationController.getRecurringStatus);

// List and cancel subscriptions owned by the logged-in donor.
router.get("/recurring", authMiddleware, donationController.getRecurringDonations);
router.post("/recurring/:recurringId/cancel", authMiddleware, donationController.cancelRecurringDonation);

// Get donation history (mobile app) — donor's own donations
router.get("/history", authMiddleware, donationController.getHistory);

// Get total donations for an organization
router.get("/total/:orgId", donationController.getTotalForOrg);

// Get received donations for an organization
router.get("/received/:orgId", donationController.getReceivedByOrg);
// Get donations received by the logged-in vet/NGO, with donor names attached
router.get("/received", authMiddleware, donationController.getReceivedDonations);

// Get all donations (admin dashboard)
router.get("/", authMiddleware, requireAdmin, donationController.getAllDonations);

module.exports = router;
