import crypto from "crypto";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { donorLookupService } from "../services/donorLookupService";

const Donation = require("../models/Donation");
const RecurringDonation = require("../models/RecurringDonation");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");

export interface IDonationInitiateRequest {
  amount: string;
  organizationId?: string;
  items?: string;
  category?: string;
  organization?: string;
  frequency?: string;
  plan?: string;
  paymentMethod?: "VISA" | "MASTER" | "AMEX";
}

export interface IDonationSaveRequest {
  orderId: string;
  amount: string | number;
  category?: string;
  organization?: string;
  organizationId?: string;
  frequency?: string;
  plan?: string;
  status?: string;
}

export class DonationController {
  private static readonly baseUrl: string = process.env.BACKEND_URL || "https://straycare-backend-69nd.onrender.com";

  public initiateDonation = catchAsync(async (req: Request<{}, {}, IDonationInitiateRequest>, res: Response, next: NextFunction): Promise<void> => {
    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({ error: "Database connection not established" });
      return;
    }

    let merchant_id = process.env.PAYHERE_MERCHANT_ID;
    let merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;
    let recurringManagementReady = !req.body.organizationId && Boolean(
      process.env.PAYHERE_APP_ID && process.env.PAYHERE_APP_SECRET
    );

    if (req.body.organizationId) {
      try {
        const org: any = await db.collection("vetprofiles").findOne({ _id: new ObjectId(req.body.organizationId) }) || 
                         await db.collection("ngoprofiles").findOne({ _id: new ObjectId(req.body.organizationId) });
        
        if (org?.merchantId) {
          // Trim to ensure no trailing/leading hidden characters break the hash match
          merchant_id = org.merchantId.trim();
          merchant_secret = org.merchantSecret.trim();
          recurringManagementReady = Boolean(org.payHereAppId?.trim() && org.payHereAppSecret?.trim());
          console.log("USING ORG MERCHANT ID:", merchant_id);
        } else {
          console.log("NO MERCHANT ID FOUND FOR ORG, USING FALLBACK");
        }
      } catch (err: any) {
        console.log("Error fetching org merchant ID, using fallback:", err.message);
      }
    }

    if (!merchant_id || !merchant_secret) {
      res.status(500).json({ error: "PayHere merchant_id or merchant_secret missing" });
      return;
    }

    const amountValue = parseFloat(req.body.amount as string);
    if (isNaN(amountValue) || amountValue <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const amount = amountValue.toFixed(2);
    const currency = "LKR";
    const order_id = "ORDER-" + Date.now();
    const allowedPaymentMethods = ["VISA", "MASTER", "AMEX"] as const;
    const payment_method = req.body.paymentMethod;
    const isRecurring = req.body.frequency === "Recurring";

    if (!payment_method || !allowedPaymentMethods.includes(payment_method)) {
      res.status(400).json({ error: "Payment method must be VISA, MASTER, or AMEX" });
      return;
    }

    if (isRecurring && payment_method === "AMEX") {
      res.status(400).json({ error: "Recurring donations support Visa or Mastercard only" });
      return;
    }

    if (isRecurring && !recurringManagementReady) {
      res.status(400).json({
        error: "This organization has not completed recurring donation setup",
      });
      return;
    }

    const recurrence = req.body.plan === "Yearly" ? "1 Year" : "1 Month";
    const duration = "Forever";

    if (isRecurring) {
      if (!req.user?.id || !["Monthly", "Yearly"].includes(req.body.plan || "")) {
        res.status(400).json({ error: "A valid recurring plan is required" });
        return;
      }

      await RecurringDonation.create({
        orderId: order_id,
        donorId: req.user.id,
        organizationId: req.body.organizationId || null,
        organization: req.body.organization || "StrayCare",
        category: req.body.category || "General",
        amount: amountValue,
        currency,
        plan: req.body.plan,
        recurrence,
        duration,
      });
    }

    // 1. Generate uppercase MD5 hash of plaintext Merchant Secret
    const hashedSecret = crypto.createHash("md5").update(merchant_secret).digest("hex").toUpperCase();
    
    // 2. Combine parameters and perform outer uppercase MD5 hash
    const hash = crypto.createHash("md5")
      .update(merchant_id + order_id + amount + currency + hashedSecret)
      .digest("hex")
      .toUpperCase();

    res.json({
      merchant_id,
      order_id,
      amount,
      currency,
      hash,
      items: req.body.items || "Donation",
      category: req.body.category || "",
      organizationId: req.body.organizationId || null,
      organization: req.body.organization || "StrayCare",
      frequency: req.body.frequency || "One-time",
      plan: req.body.plan || "",
      payment_method,
      ...(isRecurring ? { recurrence, duration } : {}),
      first_name: "Anonymous",
      last_name: "Donor",
      email: "donor@example.com",
      phone: "0771234567",
      address: "No. 1, Main Street",
      city: "Colombo",
      country: "Sri Lanka",
      return_url: `${DonationController.baseUrl}/payhere/return`,
      cancel_url: `${DonationController.baseUrl}/payhere/cancel`,
      notify_url: `${DonationController.baseUrl}/api/donations/notify`,
    });
  });

  public getPayCheckout = (req: Request, res: Response): void => {
    const {
      merchant_id,
      order_id,
      amount,
      currency,
      hash,
      return_url,
      cancel_url,
      notify_url,
      items,
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      country,
      payment_method,
      recurrence,
      duration,
    } = req.query;

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
          <input type="hidden" name="payment_method" value="${payment_method}" />
          ${recurrence ? `<input type="hidden" name="recurrence" value="${recurrence}" />` : ""}
          ${duration ? `<input type="hidden" name="duration" value="${duration}" />` : ""}
        </form>
      </body></html>`;

    res.send(formHtml);
  };

  public saveDonation = catchAsync(async (req: Request<{}, {}, IDonationSaveRequest>, res: Response, next: NextFunction): Promise<void> => {
    const { orderId, amount, category, organization, organizationId, frequency, plan, status } = req.body;
    const donorId = req.user?.id || null;

    const existing = await Donation.findOne({ orderId });
    if (existing) {
      res.json({ success: true, donation: existing });
      return;
    }

    const donation = await Donation.create({
      orderId,
      amount: parseFloat(amount as string),
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

  public notifyPayhere = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const {
      merchant_id, order_id, payment_id, payhere_amount, payhere_currency,
      status_code, md5sig, subscription_id, message_type, item_rec_install_paid,
      item_rec_status, status_message,
    } = req.body;

    if (!merchant_id || !order_id || !status_code || !md5sig) {
      res.sendStatus(400);
      return;
    }

    const recurring = await RecurringDonation.findOne({ orderId: order_id });
    if (!recurring) {
      // Preserve the existing one-time flow; recurring callbacks alone are handled here.
      res.sendStatus(200);
      return;
    }

    let merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    if (recurring.organizationId) {
      const db = mongoose.connection.db;
      if (!db || !ObjectId.isValid(recurring.organizationId)) {
        res.sendStatus(400);
        return;
      }
      const org: any = await db.collection("vetprofiles").findOne({ _id: new ObjectId(recurring.organizationId) }) ||
        await db.collection("ngoprofiles").findOne({ _id: new ObjectId(recurring.organizationId) });
      merchantSecret = org?.merchantSecret?.trim();
      if (org?.merchantId?.trim() !== merchant_id) {
        res.sendStatus(400);
        return;
      }
    } else if (process.env.PAYHERE_MERCHANT_ID?.trim() !== merchant_id) {
      res.sendStatus(400);
      return;
    }

    if (!merchantSecret) {
      res.sendStatus(500);
      return;
    }

    const hashedSecret = crypto.createHash("md5").update(merchantSecret).digest("hex").toUpperCase();
    const expectedSignature = crypto.createHash("md5")
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
      .digest("hex")
      .toUpperCase();
    const receivedSignature = String(md5sig).toUpperCase();
    const signatureValid = receivedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));

    if (!signatureValid) {
      res.sendStatus(400);
      return;
    }

    if (
      payhere_currency !== recurring.currency ||
      Number.parseFloat(payhere_amount).toFixed(2) !== Number(recurring.amount).toFixed(2)
    ) {
      res.sendStatus(400);
      return;
    }

    const successfulPayment = String(status_code) === "2" &&
      ["AUTHORIZATION_SUCCESS", "RECURRING_INSTALLMENT_SUCCESS"].includes(message_type);
    recurring.subscriptionId = subscription_id || recurring.subscriptionId;
    recurring.lastPaymentId = payment_id || recurring.lastPaymentId;
    recurring.statusMessage = status_message || "PayHere status updated";

    if (message_type === "RECURRING_COMPLETE" || String(item_rec_status) === "1") {
      recurring.status = "COMPLETED";
    } else if (message_type === "RECURRING_STOPPED" || String(item_rec_status) === "-1" || String(status_code) === "-1") {
      recurring.status = "CANCELLED";
    } else if (successfulPayment || String(item_rec_status) === "0") {
      recurring.status = "ACTIVE";
    } else if (String(status_code) === "0") {
      // Do not downgrade an already-active subscription for a pending installment.
      if (recurring.status === "PENDING") recurring.status = "PENDING";
    } else if (message_type === "AUTHORIZATION_FAILED") {
      recurring.status = "FAILED";
    }

    if (successfulPayment) {
      const installment = Number.parseInt(item_rec_install_paid, 10);
      recurring.installmentsPaid = Number.isFinite(installment)
        ? Math.max(recurring.installmentsPaid || 0, installment)
        : (recurring.installmentsPaid || 0) + 1;
      recurring.lastPaymentAt = new Date();

      const installmentOrderId = payment_id ? `PAYHERE-${payment_id}` : `${order_id}-${recurring.installmentsPaid}`;
      await Donation.updateOne(
        { orderId: installmentOrderId },
        {
          $setOnInsert: {
            orderId: installmentOrderId,
            amount: Number.parseFloat(payhere_amount),
            category: recurring.category,
            organization: recurring.organization,
            organizationId: recurring.organizationId,
            donorId: recurring.donorId,
            frequency: "Recurring",
            plan: recurring.plan,
            status: "SUCCESS",
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );
    }

    await recurring.save();
    res.sendStatus(200);
  });

  public getRecurringStatus = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const recurring = await RecurringDonation.findOne({
      orderId: req.params.orderId,
      donorId: req.user?.id,
    }).select("orderId subscriptionId status statusMessage installmentsPaid plan amount organization");

    if (!recurring) {
      res.status(404).json({ error: "Recurring donation not found" });
      return;
    }
    res.json(recurring);
  });

  public getRecurringDonations = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const recurringDonations = await RecurringDonation.find({ donorId: req.user?.id })
      .select("orderId subscriptionId status statusMessage installmentsPaid plan recurrence amount currency organization createdAt")
      .sort({ createdAt: -1 });

    res.json(recurringDonations);
  });

  public cancelRecurringDonation = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const recurringId = String(req.params.recurringId);
    if (!mongoose.Types.ObjectId.isValid(recurringId)) {
      res.status(400).json({ error: "Invalid recurring donation ID" });
      return;
    }

    const recurring = await RecurringDonation.findOne({
      _id: recurringId,
      donorId: req.user?.id,
    });

    if (!recurring) {
      res.status(404).json({ error: "Recurring donation not found" });
      return;
    }

    if (recurring.status === "CANCELLED") {
      res.status(409).json({ error: "This recurring donation is already cancelled" });
      return;
    }

    if (recurring.status !== "ACTIVE" || !recurring.subscriptionId) {
      res.status(409).json({ error: "Only an active PayHere subscription can be cancelled" });
      return;
    }

    let appId = process.env.PAYHERE_APP_ID?.trim();
    let appSecret = process.env.PAYHERE_APP_SECRET?.trim();

    if (recurring.organizationId) {
      const db = mongoose.connection.db;
      if (!db || !ObjectId.isValid(recurring.organizationId)) {
        res.status(500).json({ error: "Receiving organization could not be resolved" });
        return;
      }

      const organization: any = await db.collection("vetprofiles").findOne(
        { _id: new ObjectId(recurring.organizationId) },
        { projection: { payHereAppId: 1, payHereAppSecret: 1 } }
      ) || await db.collection("ngoprofiles").findOne(
        { _id: new ObjectId(recurring.organizationId) },
        { projection: { payHereAppId: 1, payHereAppSecret: 1 } }
      );
      appId = organization?.payHereAppId?.trim();
      appSecret = organization?.payHereAppSecret?.trim();
    }

    if (!appId || !appSecret) {
      res.status(503).json({ error: "This organization has not configured recurring cancellation" });
      return;
    }

    const basicAuthorization = Buffer.from(`${appId}:${appSecret}`).toString("base64");
    const tokenResponse = await fetch("https://sandbox.payhere.lk/merchant/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuthorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    });
    const tokenData: any = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      res.status(502).json({ error: "PayHere authentication failed. Please try again later." });
      return;
    }

    const cancelResponse = await fetch("https://sandbox.payhere.lk/merchant/v1/subscription/cancel", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription_id: recurring.subscriptionId }),
    });
    const cancelData: any = await cancelResponse.json();

    if (!cancelResponse.ok || cancelData.status !== 1) {
      res.status(502).json({
        error: cancelData.msg || "PayHere could not cancel this subscription",
      });
      return;
    }

    recurring.status = "CANCELLED";
    recurring.statusMessage = cancelData.msg || "Subscription cancelled by donor";
    await recurring.save();

    res.json({
      message: "Recurring donation cancelled successfully",
      recurringDonation: recurring,
    });
  });

  public getHistory = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const donorId = req.user?.id;
    const donations = await Donation.find({ donorId }).sort({ timestamp: -1 });
    res.json(donations);
  });

  public getTotalForOrg = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orgId } = req.params;
    const result = await Donation.aggregate([
      { $match: { organizationId: orgId, status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalAmount = result.length > 0 ? result[0].total : 0;
    res.json({ total: totalAmount });
  });

  public getReceivedByOrg = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { orgId } = req.params;
    const donations = await Donation.find({ organizationId: orgId, status: "SUCCESS" }).sort({ timestamp: -1 });
    res.json(donations);
  });

  public getReceivedDonations = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    const role = req.user?.role;
    let orgProfile: any = null;

    if (role === "vet") {
      orgProfile = await VetProfile.findOne({ userId });
    } else if (role === "ngo") {
      orgProfile = await NGOProfile.findOne({ userId });
    } else {
      res.status(403).json({ error: "Only vets and NGOs can view received donations" });
      return;
    }

    if (!orgProfile) {
      res.status(404).json({ error: "Organization profile not found" });
      return;
    }

    const orgId = orgProfile._id.toString();
    const donations = await Donation.find({ organizationId: orgId, status: "SUCCESS" }).sort({ timestamp: -1 });
    const enriched = await donorLookupService.attachDonorNames(donations);
    res.json(enriched);
  });

  public getAllDonations = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const donations = await Donation.find().sort({ timestamp: -1 });
    res.json(donations);
  });
}

export const donationController = new DonationController();

