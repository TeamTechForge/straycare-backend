"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.donationController = exports.DonationController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const catchAsync_1 = require("../utils/catchAsync");
const donorLookupService_1 = require("../services/donorLookupService");
const Donation = require("../models/Donation");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
class DonationController {
    constructor() {
        this.initiateDonation = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const db = mongoose_1.default.connection.db;
            if (!db) {
                res.status(500).json({ error: "Database connection not established" });
                return;
            }
            let merchant_id = process.env.PAYHERE_MERCHANT_ID;
            let merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;
            if (req.body.organizationId) {
                try {
                    const org = await db.collection("vetprofiles").findOne({ _id: new mongodb_1.ObjectId(req.body.organizationId) }) ||
                        await db.collection("ngoprofiles").findOne({ _id: new mongodb_1.ObjectId(req.body.organizationId) });
                    if (org?.merchantId) {
                        merchant_id = org.merchantId;
                        merchant_secret = org.merchantSecret;
                        console.log("USING ORG MERCHANT ID:", merchant_id);
                    }
                    else {
                        console.log("NO MERCHANT ID FOUND FOR ORG, USING FALLBACK");
                    }
                }
                catch (err) {
                    console.log("Error fetching org merchant ID, using fallback:", err.message);
                }
            }
            if (!merchant_id || !merchant_secret) {
                res.status(500).json({ error: "PayHere merchant_id or merchant_secret missing" });
                return;
            }
            const amountValue = parseFloat(req.body.amount);
            if (isNaN(amountValue) || amountValue <= 0) {
                res.status(400).json({ error: "Invalid amount" });
                return;
            }
            const amount = amountValue.toFixed(2);
            const currency = "LKR";
            const order_id = "ORDER-" + Date.now();
            const hashedSecret = crypto_1.default.createHash("md5").update(merchant_secret).digest("hex").toUpperCase();
            const hash = crypto_1.default.createHash("md5")
                .update(merchant_id + order_id + amount + currency + hashedSecret)
                .digest("hex")
                .toUpperCase();
            res.json({
                merchant_id, order_id, amount, currency, hash,
                items: req.body.items || "Donation",
                category: req.body.category || "",
                organizationId: req.body.organizationId || null,
                organization: req.body.organization || "StrayCare",
                frequency: req.body.frequency || "One-time",
                plan: req.body.plan || "",
                first_name: "Anonymous", last_name: "Donor",
                email: "donor@example.com", phone: "0771234567",
                address: "No. 1, Main Street", city: "Colombo", country: "Sri Lanka",
                return_url: `https://straycareapp.com/payhere/return`,
                cancel_url: `https://straycareapp.com/payhere/cancel`,
                notify_url: `https://straycareapp.com/payhere/notify`,
            });
        });
        this.getPayCheckout = (req, res) => {
            const { merchant_id, order_id, amount, currency, hash, return_url, cancel_url, notify_url, items, first_name, last_name, email, phone, address, city, country, } = req.query;
            const formHtml = `
      <html><body onload="document.forms[0].submit()">
        <form method="post" action="https://sandbox.payhere.lk/pay/checkout">
          <input type="hidden" name="merchant_id" value="${merchant_id}" />
          <input type="hidden" name="order_id" value="${order_id}" />
          <input type="hidden" name="items" value="${items}" />
          <input type="hidden" name="amount" value="${amount}" />
          <input type="hidden" name="currency" value="${currency}" />
          <input type="hidden" name="hash" value="${hash}" />
          <input type="hidden" name="return_url" value="${return_url}" />
          <input type="hidden" name="cancel_url" value="${cancel_url}" />
          <input type="hidden" name="notify_url" value="${notify_url}" />
          <input type="hidden" name="first_name" value="${first_name}" />
          <input type="hidden" name="last_name" value="${last_name}" />
          <input type="hidden" name="email" value="${email}" />
          <input type="hidden" name="phone" value="${phone}" />
          <input type="hidden" name="address" value="${address}" />
          <input type="hidden" name="city" value="${city}" />
          <input type="hidden" name="country" value="${country}" />
        </form>
      </body></html>`;
            res.send(formHtml);
        };
        this.saveDonation = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const { orderId, amount, category, organization, organizationId, frequency, plan, status } = req.body;
            const donorId = req.user?.id || null;
            const donation = await Donation.create({
                orderId,
                amount: parseFloat(amount),
                category: category || "General",
                organization: organization || "StrayCare",
                organizationId: organizationId || null,
                donorId,
                frequency: frequency || "One-time",
                plan: plan || "",
                status: status || "SUCCESS",
                timestamp: new Date(),
            });
            res.json({ success: true, donation });
        });
        this.notifyPayhere = (req, res) => {
            console.log("PAYHERE NOTIFY:", req.body);
            res.sendStatus(200);
        };
        this.getHistory = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const donorId = req.user?.id;
            const donations = await Donation.find({ donorId }).sort({ timestamp: -1 });
            res.json(donations);
        });
        this.getTotalForOrg = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const { orgId } = req.params;
            const result = await Donation.aggregate([
                { $match: { organizationId: orgId, status: "SUCCESS" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const totalAmount = result.length > 0 ? result[0].total : 0;
            res.json({ total: totalAmount });
        });
        this.getReceivedByOrg = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const { orgId } = req.params;
            const donations = await Donation.find({ organizationId: orgId, status: "SUCCESS" }).sort({ timestamp: -1 });
            res.json(donations);
        });
        this.getReceivedDonations = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const userId = req.user?.id;
            const role = req.user?.role;
            let orgProfile = null;
            if (role === "vet") {
                orgProfile = await VetProfile.findOne({ userId });
            }
            else if (role === "ngo") {
                orgProfile = await NGOProfile.findOne({ userId });
            }
            else {
                res.status(403).json({ error: "Only vets and NGOs can view received donations" });
                return;
            }
            if (!orgProfile) {
                res.status(404).json({ error: "Organization profile not found" });
                return;
            }
            const orgId = orgProfile._id.toString();
            const donations = await Donation.find({ organizationId: orgId, status: "SUCCESS" }).sort({ timestamp: -1 });
            const enriched = await donorLookupService_1.donorLookupService.attachDonorNames(donations);
            res.json(enriched);
        });
        this.getAllDonations = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
            const donations = await Donation.find().sort({ timestamp: -1 });
            res.json(donations);
        });
    }
}
exports.DonationController = DonationController;
DonationController.baseUrl = process.env.BACKEND_URL || "http://192.168.8.100:5000";
exports.donationController = new DonationController();
//# sourceMappingURL=donationController.js.map