import { Request, Response } from "express";
import CommunityPost from "../models/communityPost";

// ─────────────────────────────────────────────
// POST /api/community/create
// Create a new community post
// ─────────────────────────────────────────────
export const createCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        // Cloudinary URL can be sent from the frontend.
        // If you are still using multer, req.file can also be supported.
        const imageUrl =
            req.body.imageUrl ||
            (req.file ? `/uploads/${req.file.filename}` : null);

        const {
            title,
            category,
            content,
            authorName,
            submittedAt,
        } = req.body;

        // Basic validation
        if (!title || !category || !content) {
            res.status(400).json({
                success: false,
                message: "Title, category and content are required",
            });
            return;
        }

        const post = new CommunityPost({
            title,
            category,
            content,
            imageUrl,
            authorName,
            submittedAt: submittedAt
                ? new Date(submittedAt)
                : new Date(),
        });

        const savedPost = await post.save();

        res.status(201).json({
            success: true,
            data: savedPost,
        });
    } catch (error) {
        console.error("Create community post error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create community post",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/community
// Get all community posts
// ─────────────────────────────────────────────
export const getAllCommunityPosts = async (
    _req: Request,
    res: Response
): Promise<void> => {
    try {
        const posts = await CommunityPost.find().sort({
            submittedAt: -1,
        });

        res.status(200).json({
            success: true,
            data: posts,
        });
    } catch (error) {
        console.error("Get community posts error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community posts",
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/community/:id
// Get one community post
// ─────────────────────────────────────────────
export const getCommunityPostById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const post = await CommunityPost.findById(id);

        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: post,
        });
    } catch (error) {
        console.error("Get community post error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community post",
        });
    }
};

// ─────────────────────────────────────────────
// POST /api/community/:id/report
// Report a community post
// ─────────────────────────────────────────────
export const reportCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const post = await CommunityPost.findById(id);

        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        // Make sure reports exists before pushing
        if (!Array.isArray(post.reports)) {
            post.reports = [];
        }

        post.reports.push({
            reason: reason || "No reason provided",
            reportedAt: new Date(),
        });

        await post.save();

        res.status(200).json({
            success: true,
            message: "Post reported successfully",
        });
    } catch (error) {
        console.error("Report community post error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to report community post",
        });
    }
};