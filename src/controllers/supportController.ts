import { Request, Response } from "express";
const SupportTicket = require("../models/SupportTicket");

exports.createSupportTicket = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const { subject, category, message } = req.body;
    const userId = req.user.id;

    if (!subject || subject.trim().length < 5 || subject.trim().length > 100) {
      res.status(400).json({ error: "Subject must be between 5 and 100 characters" });
      return;
    }

    if (!message || message.trim().length < 10 || message.trim().length > 2000) {
      res.status(400).json({ error: "Message must be between 10 and 2000 characters" });
      return;
    }

    const validCategories = ["Bug Report", "Account Issue", "Feature Request", "Technical Support", "General Inquiry"];
    let finalCategory = category;
    if (!validCategories.includes(category)) {
      finalCategory = "General Inquiry";
    }

    const newTicket = new SupportTicket({
      userId,
      subject: subject.trim(),
      category: finalCategory,
      message: message.trim(),
    });

    await newTicket.save();

    res.status(201).json({
      message: "Your support request has been submitted successfully.",
      ticketId: newTicket._id,
    });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    res.status(500).json({ error: "Failed to submit support request" });
  }
};

exports.getAllSupportTickets = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const tickets = await SupportTicket.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name email");

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
};

exports.updateSupportTicket = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminReply } = req.body;

    const validStatuses = ["Pending", "In Progress", "Resolved", "Closed"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const update: any = {};
    if (status) update.status = status;
    if (adminReply !== undefined) update.adminReply = adminReply;

    const ticket = await SupportTicket.findByIdAndUpdate(id, update, { new: true });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({ message: "Ticket updated successfully", ticket });
  } catch (error) {
    console.error("Error updating support ticket:", error);
    res.status(500).json({ error: "Failed to update ticket" });
  }
};
