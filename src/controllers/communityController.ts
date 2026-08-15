import { Request, Response } from "express";
import mongoose from "mongoose";

import CommunityPost from "../models/communityPost";
import CommunityReport from "../models/CommunityReport";
import CommunityLike from "../models/CommunityLike";
import CommunityComment from "../models/CommunityComment";
import User from "../models/User";
const Notification = require("../models/Notification");
const GeneralUserProfile = require("../models/GeneralUserProfile");
const VolunteerProfile = require("../models/VolunteerProfile");
const VetProfile = require("../models/VetProfile");
const NGOProfile = require("../models/NGOProfile");
const { uploadFileToCloudinary } = require("../utils/cloudinaryUpload");

interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    filename?: string;
}

type UploadRequest = Request & {
    file?: UploadedFile;
    files?: UploadedFile[] | Record<string, UploadedFile[]>;
};

const profileModels: Record<string, any> = {
    general_user: GeneralUserProfile,
    volunteer: VolunteerProfile,
    vet: VetProfile,
    ngo: NGOProfile,
};

const getAuthorDetails = async (authorUserId?: unknown) => {
    if (!authorUserId || !mongoose.Types.ObjectId.isValid(String(authorUserId))) {
        return null;
    }

    const user: any = await User.findById(authorUserId)
        .select("name profileImage avatar role")
        .lean();
    if (!user) return null;

    let profileImage = user.profileImage || user.avatar || "";
    const ProfileModel = profileModels[user.role];
    if (ProfileModel) {
        const profile: any = await ProfileModel.findOne({ userId: user._id })
            .select("profileImage")
            .lean();
        profileImage = profile?.profileImage || profileImage;
    }

    return { username: user.name, profileImage };
};

const serializePost = async (post: any, currentUserId?: string) => {
    const plain = typeof post.toObject === "function" ? post.toObject() : post;
    const authorId = plain.authorUserId ? String(plain.authorUserId) : null;
    const author = await getAuthorDetails(plain.authorUserId);

    const [likeCount, commentCount, isLiked] = await Promise.all([
        CommunityLike.countDocuments({ postId: plain._id }),
        CommunityComment.countDocuments({ postId: plain._id }),
        currentUserId
            ? CommunityLike.exists({ postId: plain._id, userId: currentUserId })
            : Promise.resolve(null),
    ]);

    return {
        ...plain,
        authorUserId: authorId,
        authorId,
        username: author?.username || plain.authorName || "Community User",
        profileImage: author?.profileImage || "",
        date: plain.submittedAt || plain.createdAt,
        likeCount,
        commentCount,
        isLiked: Boolean(isLiked),
        isSaved: false,
        isOwner: Boolean(currentUserId && authorId === currentUserId),
    };
};

const serializeComment = async (comment: any) => {
    const plain = typeof comment.toObject === "function" ? comment.toObject() : comment;
    const commenter = await getAuthorDetails(plain.userId);

    return {
        _id: String(plain._id),
        postId: String(plain.postId),
        userId: String(plain.userId),
        username: commenter?.username || "Community User",
        profileImage: commenter?.profileImage || "",
        content: plain.content,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};

export const getCommunityComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const postId = req.params.id;
        if (typeof postId !== "string" || !mongoose.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, message: "Invalid post ID" });
            return;
        }
        if (!(await CommunityPost.exists({ _id: postId }))) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }

        const comments = await CommunityComment.find({ postId }).sort({ createdAt: 1 });
        res.status(200).json({
            success: true,
            data: await Promise.all(comments.map(serializeComment)),
            commentCount: comments.length,
        });
    } catch (error) {
        console.error("Get community comments error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch comments" });
    }
};

export const createCommunityComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
        if (!content) {
            res.status(400).json({ success: false, message: "Comment content is required" });
            return;
        }
        if (content.length > 1000) {
            res.status(400).json({ success: false, message: "Comment cannot exceed 1000 characters" });
            return;
        }

        const { postId, userId, post, user } = context;
        const comment = await CommunityComment.create({ postId, userId, content });
        const ownerId = post.authorUserId ? String(post.authorUserId) : null;

        if (ownerId && ownerId !== userId) {
            const preview = content.length > 60 ? `${content.slice(0, 60)}…` : content;
            try {
                await Notification.updateOne(
                    { type: "post_comment", commentId: comment._id },
                    {
                        $setOnInsert: {
                            userId: ownerId,
                            actorUserId: userId,
                            type: "post_comment",
                            postId,
                            commentId: comment._id,
                            title: "New post comment",
                            message: `${user.name} commented on your post: ${preview}`,
                            event: "post_comment",
                            read: false,
                        },
                    },
                    { upsert: true }
                );
            } catch (notificationError) {
                console.error("Create comment notification error:", notificationError);
            }
        }

        const commentCount = await CommunityComment.countDocuments({ postId });
        res.status(201).json({
            success: true,
            data: await serializeComment(comment),
            commentCount,
        });
    } catch (error) {
        console.error("Create community comment error:", error);
        res.status(500).json({ success: false, message: "Failed to create comment" });
    }
};

const getValidatedPostAndUser = async (req: Request, res: Response) => {
    const postId = req.params.id;
    const userId = req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return null;
    }
    if (typeof postId !== "string" || !mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, message: "Invalid post ID" });
        return null;
    }

    const [post, user] = await Promise.all([
        CommunityPost.findById(postId),
        User.findById(userId).select("name"),
    ]);
    if (!user) {
        res.status(401).json({ success: false, message: "Authenticated user not found" });
        return null;
    }
    if (!post) {
        res.status(404).json({ success: false, message: "Post not found" });
        return null;
    }

    return { postId, userId, post, user };
};

export const likeCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const { postId, userId, post, user } = context;
        let created = false;
        try {
            await CommunityLike.create({ postId, userId });
            created = true;
        } catch (error: any) {
            if (error?.code !== 11000) throw error;
        }

        const ownerId = post.authorUserId ? String(post.authorUserId) : null;
        if (created && ownerId && ownerId !== userId) {
            await Notification.updateOne(
                { userId: ownerId, actorUserId: userId, type: "post_like", postId },
                {
                    $setOnInsert: {
                        userId: ownerId,
                        actorUserId: userId,
                        type: "post_like",
                        postId,
                        title: "New post like",
                        message: `${user.name} liked your post.`,
                        event: "post_like",
                        read: false,
                    },
                },
                { upsert: true }
            );
        }

        const likeCount = await CommunityLike.countDocuments({ postId });
        res.status(created ? 201 : 200).json({
            success: true,
            data: { postId, isLiked: true, likeCount },
        });
    } catch (error) {
        console.error("Like community post error:", error);
        res.status(500).json({ success: false, message: "Failed to like community post" });
    }
};

export const unlikeCommunityPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const context = await getValidatedPostAndUser(req, res);
        if (!context) return;

        const { postId, userId } = context;
        await CommunityLike.deleteOne({ postId, userId });
        const likeCount = await CommunityLike.countDocuments({ postId });

        res.status(200).json({
            success: true,
            data: { postId, isLiked: false, likeCount },
        });
    } catch (error) {
        console.error("Unlike community post error:", error);
        res.status(500).json({ success: false, message: "Failed to unlike community post" });
    }
};

// ─────────────────────────────────────────────
// POST /api/community/create
// Create a new community post
// ─────────────────────────────────────────────

export const createCommunityPost = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const authorUserId = req.user?.id;
        if (!authorUserId || !mongoose.Types.ObjectId.isValid(authorUserId)) {
            res.status(401).json({ success: false, message: "Authentication required to create a post" });
            return;
        }

        const author = await User.findById(authorUserId).select("_id");
        if (!author) {
            res.status(401).json({ success: false, message: "Authenticated user not found" });
            return;
        }

        let imageUrl: string | null =
            req.body.imageUrl ||
            req.body.image ||
            null;

        const uploadRequest = req as UploadRequest;
        const file =
            uploadRequest.file ||
            (uploadRequest.files && Array.isArray(uploadRequest.files) && uploadRequest.files.length > 0
                ? uploadRequest.files[0]
                : null);

        if (file) {
            try {
                imageUrl = await uploadFileToCloudinary(file);
            } catch (fileErr) {
                console.error("Cloudinary upload error:", fileErr);
                res.status(502).json({
                    success: false,
                    message: "The post image could not be uploaded. Please try again.",
                });
                return;
            }
        }

        const {
            title,
            category,
            content,
        } = req.body;

        const trimmedTitle = typeof title === "string" ? title.trim() : "";
        const trimmedCategory = typeof category === "string" ? category.trim() : "";
        const trimmedContent = typeof content === "string" ? content.trim() : "";

        // Basic validation
        if (!trimmedTitle || !trimmedCategory || !trimmedContent) {
            res.status(400).json({
                success: false,
                message:
                    "Title, category and content are required",
            });
            return;
        }

        const post = new CommunityPost({
            authorUserId,
            title: trimmedTitle,
            category: trimmedCategory,
            content: trimmedContent,
            imageUrl,
            submittedAt: new Date(),
        });

        const savedPost = await post.save();

        res.status(201).json({
            success: true,
            data: await serializePost(savedPost, authorUserId),
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
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const posts =
            await CommunityPost.find().sort({
                submittedAt: -1,
            });

        const data = await Promise.all(posts.map((post) => serializePost(post, req.user?.id)));

        res.status(200).json({
            success: true,
            data,
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
        const id = req.params.id;

        if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: "Invalid post ID" });
            return;
        }

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
            data: await serializePost(post, req.user?.id),
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
        const postId = req.params.id as string;

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

                // Store a moderation snapshot so the reported evidence is
                // still available if the community post changes or is removed.
                postSnapshot: {
                    title: post.title,
                    content: post.content,
                    category: post.category,
                    imageUrl: post.imageUrl,
                    authorName: post.authorName,
                    submittedAt: post.submittedAt,
                },

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

                postSnapshot:
                    report.postSnapshot,

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

// ─────────────────────────────────────────────
// GET /api/community/admin/reports
// Admin endpoint: Get all community post reports with populated post details
// ─────────────────────────────────────────────

export const getCommunityReports = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { status } = req.query;

        const filter: any = {};
        if (status && typeof status === "string") {
            filter.status = status;
        }

        const reports = await CommunityReport.find(filter)
            .populate("postId")
            .populate("reporterUserId", "name email username role")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error("Get community reports error:", error);
        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to fetch community reports",
        });
    }
};

// ─────────────────────────────────────────────
// PATCH /api/community/admin/reports/:reportId
// Admin endpoint: Update community report review status
// ─────────────────────────────────────────────

export const updateCommunityReportStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;
        const reviewerId = req.user?.id;

        if (!status || !["pending", "dismissed", "action_taken"].includes(status)) {
            res.status(400).json({
                success: false,
                message: "Valid status ('pending', 'dismissed', 'action_taken') is required",
            });
            return;
        }

        const report = await CommunityReport.findByIdAndUpdate(
            reportId,
            {
                status,
                reviewedBy: reviewerId || null,
                reviewedAt: new Date(),
            },
            { new: true }
        ).populate("postId");

        if (!report) {
            res.status(404).json({
                success: false,
                message: "Community report not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Report status updated to ${status}`,
            data: report,
        });
    } catch (error) {
        console.error("Update community report error:", error);
        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update community report",
        });
    }
};
// End of Community Controller
