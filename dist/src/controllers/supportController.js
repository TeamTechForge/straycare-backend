"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SupportTicket = require("../models/SupportTicket");
exports.createSupportTicket = async (req, res) => {
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
    }
    catch (error) {
        console.error("Error creating support ticket:", error);
        res.status(500).json({ error: "Failed to submit support request" });
    }
};
//# sourceMappingURL=supportController.js.map