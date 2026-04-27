
const express = require("express");
const crypto = require("crypto");
const Donation = require("../models/Donation");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

const baseUrl = process.env.BACKEND_URL || "http://192.168.8.102:5000";

// Initiate a donation 
router.post("/initiate", (req, res) => {
  try {
    const merchant_id = process.env.PAYHERE_MERCHANT_ID;
    const merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!merchant_id || !merchant_secret) {
      return res.status(500).json({ error: "PayHere merchant_id or merchant_secret missing" });
    }
    const amountValue = parseFloat(req.body.amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const amount = amountValue.toFixed(2);
    const currency = "LKR";
    const order_id = "ORDER-" + Date.now();
    const hashedSecret = crypto.createHash("md5").update(merchant_secret).digest("hex").toUpperCase();
    const hash = crypto.createHash("md5")
      .update(merchant_id + order_id + amount + currency + hashedSecret)
      .digest("hex")
      .toUpperCase();
    return res.json({
      merchant_id, order_id, amount, currency, hash,
      items: req.body.items || "Donation",
      category: req.body.category || "",
      organization: req.body.organization || "StrayCare",
      frequency: req.body.frequency || "One-time",
      plan: req.body.plan || "",
      first_name: "Anonymous", last_name: "Donor",
      email: "donor@example.com", phone: "0771234567",
      address: "No. 1, Main Street", city: "Colombo", country: "Sri Lanka",
      return_url: `${baseUrl}/payhere/return`,
      cancel_url: `${baseUrl}/payhere/cancel`,
      notify_url: `${baseUrl}/payhere/notify`,
    });
  } catch (err) {
    console.error("INITIATE ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

//Redirect to PayHere checkout 
router.get("/pay", (req, res) => {
  const { merchant_id, order_id, amount, currency, hash, return_url, cancel_url, notify_url, items, first_name, last_name, email, phone, address, city, country } = req.query;
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
});

// Save donation after payment
router.post("/save", async (req, res) => {
  try {
    const { orderId, amount, category, organization, frequency, plan, status } = req.body;
    const donation = await Donation.create({
      orderId,
      amount: parseFloat(amount),
      category: category || "General",
      organization: organization || "StrayCare",
      frequency: frequency || "One-time",
      plan: plan || "",
      status: status || "SUCCESS",
      timestamp: new Date(),
    });
    res.json({ success: true, donation });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ error: "Failed to save donation" });
  }
});

// PayHere notify callback 
router.post("/notify", (req, res) => {
  console.log("PAYHERE NOTIFY:", req.body);
  res.sendStatus(200);
});

// Test hash
router.get("/test-hash", (req, res) => {
  const merchant_id = process.env.PAYHERE_MERCHANT_ID;
  const merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;
  const order_id = "ORDER123";
  const amount = (1000.00).toFixed(2);
  const currency = "LKR";
  const hashedSecret = crypto.createHash("md5").update(merchant_secret).digest("hex").toUpperCase();
  const raw = merchant_id + order_id + amount + currency + hashedSecret;
  const hash = crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
  res.json({ merchant_id, merchant_secret, hashedSecret, raw, hash, baseUrl });
});

// Get donation history 
router.get("/history", async (req, res) => {
  try {
    const donations = await Donation.find().sort({ timestamp: -1 });
    res.json(donations);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

// Get all donations (admin dashboard only) 
router.get("/", authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find().sort({ timestamp: -1 });
    res.json(donations);
  } catch (err) {
    console.error("BASE ROUTE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

module.exports = router;