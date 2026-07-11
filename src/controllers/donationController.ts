import crypto from "crypto";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";

const Donation = require("../models/Donation");

export interface IDonationInitiateRequest {
  amount: string;
  organizationId?: string;
  items?: string;
  category?: string;
  organization?: string;
  frequency?: string;
  plan?: string;
}

export interface IDonationSaveRequest {
  orderId: string;
  amount: string | number;
  category?: string;
  organization?: string;
  organizationId?: string;
  donorId?: string;
  frequency?: string;
  plan?: string;
  status?: string;
}

export class DonationController {
  private static readonly baseUrl: string = process.env.BACKEND_URL || "http://192.168.8.160:5000";

  public initiateDonation = catchAsync(async (req: Request<{}, {}, IDonationInitiateRequest>, res: Response, next: NextFunction): Promise<void> => {
    const db = mongoose.connection.db;
      if (!db) {
        res.status(500).json({ error: "Database connection not established" });
        return;
      }
      
      let merchant_id = process.env.PAYHERE_MERCHANT_ID;
      let merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;

      if (req.body.organizationId) {
        try {
          const org: any =
            await db.collection("vetprofiles").findOne({ _id: new ObjectId(req.body.organizationId) }) ||
            await db.collection("ngoprofiles").findOne({ _id: new ObjectId(req.body.organizationId) });

          if (org?.merchantId) {
            merchant_id = org.merchantId;
            merchant_secret = org.merchantSecret;
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

      const hashedSecret = crypto.createHash("md5").update(merchant_secret).digest("hex").toUpperCase();
      const hash = crypto.createHash("md5")
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

  public getPayCheckout = (req: Request, res: Response): void => {
    const {
      merchant_id, order_id, amount, currency, hash,
      return_url, cancel_url, notify_url, items,
      first_name, last_name, email, phone, address, city, country,
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
        </form>
      </body></html>`;
    res.send(formHtml);
  };

  public saveDonation = catchAsync(async (req: Request<{}, {}, IDonationSaveRequest>, res: Response, next: NextFunction): Promise<void> => {
    const { orderId, amount, category, organization, organizationId, donorId, frequency, plan, status } = req.body;
      const donation = await Donation.create({
        orderId,
        amount: parseFloat(amount as string),
        category: category || "General",
        organization: organization || "StrayCare",
        organizationId: organizationId || null,
        donorId: donorId || null,
        frequency: frequency || "One-time",
        plan: plan || "",
        status: status || "SUCCESS",
        timestamp: new Date(),
      });
    res.json({ success: true, donation });
  });

  public notifyPayhere = (req: Request, res: Response): void => {
    console.log("PAYHERE NOTIFY:", req.body);
    res.sendStatus(200);
  };

  public getHistory = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const donations = await Donation.find().sort({ timestamp: -1 });
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

  public getAllDonations = catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const donations = await Donation.find().sort({ timestamp: -1 });
    res.json(donations);
  });
}

export const donationController = new DonationController();
