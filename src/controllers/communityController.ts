import { Request, Response } from "express";

import CommunityPost from "../models/communityPost";
import CommunityReport from "../models/CommunityReport";

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
        // If multer is being used, req.file is also supported.
        const imageUrl =
            req.body.imageUrl ||
            (req.file
                ? `/uploads/${req.file.filename}`
                : null);

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
                message:
                    "Title, category and content are required",
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
        console.error(
            "Create community post error:",
            error
        );

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
        const posts =
            await CommunityPost.find().sort({
                submittedAt: -1,
            });

        res.status(200).json({
            success: true,
            data: posts,
        });
    } catch (error) {
        console.error(
            "Get community posts error:",
            error
        );

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

        const post =
            await CommunityPost.findById(id);

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
        console.error(
            "Get community post error:",
            error
        );

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
//
// Requires verifyToken middleware.
//
// User sends:
// {
//     "reason": "Spam or irrelevant"
// }
//
// Backend gets:
// postId        -> req.params.id
// reporter ID   -> req.user.id
// reason        -> req.body.reason
// ─────────────────────────────────────────────

export const reportCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id: postId } = req.params;

        const { reason } = req.body;

        // verifyToken middleware creates:
        //
        // req.user = {
        //     id: decoded.id,
        //     role: decoded.role
        // }
        //
        // Therefore, NEVER trust a userId sent
        // from the frontend for reporting.
        const reporterUserId =
            req.user?.id;

        // ─────────────────────────────────────
        // 1. CHECK AUTHENTICATION
        // ─────────────────────────────────────

        if (!reporterUserId) {
            res.status(401).json({
                success: false,
                message:
                    "Authentication required to report a post",
            });
            return;
        }

        // ─────────────────────────────────────
        // 2. VALIDATE REPORT REASON
        // ─────────────────────────────────────

        if (
            !reason ||
            typeof reason !== "string" ||
            reason.trim().length === 0
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Report reason is required",
            });
            return;
        }

        if (reason.trim().length > 300) {
            res.status(400).json({
                success: false,
                message:
                    "Report reason cannot exceed 300 characters",
            });
            return;
        }

        // ─────────────────────────────────────
        // 3. CHECK THAT POST EXISTS
        // ─────────────────────────────────────

        const post =
            await CommunityPost.findById(
                postId
            );

        if (!post) {
            res.status(404).json({
                success: false,
                message: "Post not found",
            });
            return;
        }

        // ─────────────────────────────────────
        // 4. CHECK FOR DUPLICATE REPORT
        // ─────────────────────────────────────
        //
        // Same user should not be able to
        // report the same post repeatedly.

        const existingReport =
            await CommunityReport.findOne({
                postId,
                reporterUserId,
            });

        if (existingReport) {
            res.status(409).json({
                success: false,
                message:
                    "You have already reported this post",
            });
            return;
        }

        // ─────────────────────────────────────
        // 5. CREATE REPORT
        // ─────────────────────────────────────

        const report =
            await CommunityReport.create({
                postId,
                reporterUserId,

                reason: reason.trim(),

                // Admin will review this later
                status: "pending",
            });

        // ─────────────────────────────────────
        // 6. RETURN SUCCESS RESPONSE
        // ─────────────────────────────────────

        res.status(201).json({
            success: true,

            message:
                "Post reported successfully",

            data: {
                // MongoDB automatically creates
                // the unique report ID.
                reportId: report._id,

                postId:
                    report.postId,

                reporterUserId:
                    report.reporterUserId,

                reason:
                    report.reason,

                status:
                    report.status,

                createdAt:
                    report.createdAt,
            },
        });
    } catch (error: any) {
        // Extra protection for the unique
        // postId + reporterUserId database index.
        if (error?.code === 11000) {
            res.status(409).json({
                success: false,
                message:
                    "You have already reported this post",
            });
            return;
        }

        console.error(
            "Report community post error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to report community post",
        });
    }
};