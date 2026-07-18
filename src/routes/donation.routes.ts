const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

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

// Get donation history (mobile app) — donor's own donations
router.get("/history", authMiddleware, donationController.getHistory);

// Get total donations for an organization
router.get("/total/:orgId", donationController.getTotalForOrg);

// Get donations received by the logged-in vet/NGO, with donor names attached
router.get("/received", authMiddleware, donationController.getReceivedDonations);

// Get all donations (admin dashboard)
router.get("/", authMiddleware, donationController.getAllDonations);

module.exports = router;
